import { useEffect, useState, useRef, useCallback } from "react";
import { useLocation, useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Camera, Image, Plus, Trash2, ChevronLeft, ChevronRight, ArrowUp, ArrowDown, Pencil, MessageSquare, Send, Heart, HelpCircle, Hand, AlertTriangle, Users, ZoomIn, X, RotateCcw } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { ItemWithPhotos, ItemWithPhotosAndDeleteInfo, CommentWithUser, Preference, PreferenceWithUser, User } from "@shared/schema";

function formatCommentDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return "Aujourd'hui";
  if (diffDays === 1) return "Hier";
  if (diffDays < 7) return `Il y a ${diffDays} jours`;
  
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long'
  });
}

function formatDeleteDate(dateString: string | Date): string {
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

const MAX_WIDTH = 1200;
const MAX_HEIGHT = 1200;
const QUALITY = 0.8;

function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let { width, height } = img;
        
        if (width > MAX_WIDTH) {
          height = (height * MAX_WIDTH) / width;
          width = MAX_WIDTH;
        }
        if (height > MAX_HEIGHT) {
          width = (width * MAX_HEIGHT) / height;
          height = MAX_HEIGHT;
        }
        
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Impossible de créer le contexte canvas"));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", QUALITY));
      };
      img.onerror = () => reject(new Error("Impossible de charger l'image"));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error("Impossible de lire le fichier"));
    reader.readAsDataURL(file);
  });
}

export default function ItemDetailPage() {
  const params = useParams<{ id: string }>();
  const itemId = parseInt(params.id || "0");
  const [, setLocation] = useLocation();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState("");
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [descriptionValue, setDescriptionValue] = useState("");
  const [newComment, setNewComment] = useState("");
  const [showLightbox, setShowLightbox] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [lastPinchDistance, setLastPinchDistance] = useState<number | null>(null);
  const titleTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const descriptionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const descriptionTextareaRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    const storedUserId = localStorage.getItem("user_id");
    if (!storedUserId) {
      setLocation("/");
      return;
    }
    setCurrentUserId(storedUserId);
  }, [setLocation]);

  const { data: item, isLoading } = useQuery<ItemWithPhotosAndDeleteInfo>({
    queryKey: ["/api/items", itemId],
    enabled: itemId > 0,
  });

  const { data: comments = [], isLoading: isLoadingComments } = useQuery<CommentWithUser[]>({
    queryKey: ["/api/items", itemId, "comments"],
    enabled: itemId > 0,
  });

  const { data: myPreference, isLoading: isLoadingPreference } = useQuery<Preference | null>({
    queryKey: ["/api/items", itemId, "preferences", "me", currentUserId],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/items/${itemId}/preferences/me`, undefined, {
        "X-User-Id": currentUserId || "",
      });
      if (!response.ok) return null;
      return await response.json();
    },
    enabled: itemId > 0 && !!currentUserId,
  });

  const { data: allPreferences = [], isLoading: isLoadingAllPreferences } = useQuery<PreferenceWithUser[]>({
    queryKey: ["/api/items", itemId, "preferences"],
    queryFn: async () => {
      const response = await fetch(`/api/items/${itemId}/preferences`);
      if (!response.ok) return [];
      return await response.json();
    },
    enabled: itemId > 0,
  });

  const { data: allUsers = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const response = await fetch("/api/users");
      if (!response.ok) return [];
      return await response.json();
    },
  });

  // Synchroniser titleValue et descriptionValue quand item change
  useEffect(() => {
    if (item) {
      setTitleValue(item.title || "");
      setDescriptionValue(item.description || "");
    }
  }, [item]);

  const updateItemMutation = useMutation({
    mutationFn: async (data: { title?: string | null; description?: string | null }) => {
      const response = await apiRequest("PATCH", `/api/items/${itemId}`, data, {
        "X-User-Id": currentUserId || "",
      });
      return await response.json() as ItemWithPhotos;
    },
    onSuccess: (updatedItem) => {
      queryClient.setQueryData(["/api/items", itemId], updatedItem);
      queryClient.setQueryData(["/api/items"], (oldData: ItemWithPhotos[] | undefined) => {
        if (!oldData) return oldData;
        return oldData.map(i => i.id === itemId ? updatedItem : i);
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de sauvegarder les modifications.",
        variant: "destructive",
      });
    },
  });

  const saveTitle = useCallback((value: string) => {
    const trimmedValue = value.trim();
    updateItemMutation.mutate({ title: trimmedValue || null });
  }, [updateItemMutation]);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value.slice(0, 100);
    setTitleValue(newValue);
    
    if (titleTimeoutRef.current) {
      clearTimeout(titleTimeoutRef.current);
    }
    titleTimeoutRef.current = setTimeout(() => saveTitle(newValue), 1000);
  };

  const handleTitleBlur = () => {
    if (titleTimeoutRef.current) {
      clearTimeout(titleTimeoutRef.current);
    }
    saveTitle(titleValue);
    setIsEditingTitle(false);
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      if (titleTimeoutRef.current) {
        clearTimeout(titleTimeoutRef.current);
      }
      saveTitle(titleValue);
      setIsEditingTitle(false);
    }
    if (e.key === "Escape") {
      setTitleValue(item?.title || "");
      setIsEditingTitle(false);
    }
  };

  const startEditingTitle = () => {
    setIsEditingTitle(true);
    setTimeout(() => titleInputRef.current?.focus(), 50);
  };

  const saveDescription = useCallback((value: string) => {
    const trimmedValue = value.trim();
    updateItemMutation.mutate({ description: trimmedValue || null });
  }, [updateItemMutation]);

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setDescriptionValue(newValue);
    
    if (descriptionTimeoutRef.current) {
      clearTimeout(descriptionTimeoutRef.current);
    }
    descriptionTimeoutRef.current = setTimeout(() => saveDescription(newValue), 1000);
  };

  const handleDescriptionBlur = () => {
    if (descriptionTimeoutRef.current) {
      clearTimeout(descriptionTimeoutRef.current);
    }
    saveDescription(descriptionValue);
    setIsEditingDescription(false);
  };

  const handleDescriptionKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setDescriptionValue(item?.description || "");
      setIsEditingDescription(false);
    }
  };

  const startEditingDescription = () => {
    setIsEditingDescription(true);
    setTimeout(() => descriptionTextareaRef.current?.focus(), 50);
  };

  const addPhotoMutation = useMutation({
    mutationFn: async (photoData: string) => {
      const response = await apiRequest("POST", `/api/items/${itemId}/photos`, { photo: photoData }, {
        "X-User-Id": currentUserId || "",
      });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/items", itemId] });
      queryClient.invalidateQueries({ queryKey: ["/api/items"] });
      toast({
        title: "Photo ajoutée !",
        description: "La photo a été ajoutée à la fiche.",
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible d'ajouter la photo.",
        variant: "destructive",
      });
    },
  });

  const deletePhotoMutation = useMutation({
    mutationFn: async (photoId: number) => {
      await apiRequest("DELETE", `/api/items/${itemId}/photos/${photoId}`, undefined, {
        "X-User-Id": currentUserId || "",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/items", itemId] });
      queryClient.invalidateQueries({ queryKey: ["/api/items"] });
      if (item && currentPhotoIndex >= item.photos.length - 1) {
        setCurrentPhotoIndex(Math.max(0, currentPhotoIndex - 1));
      }
      toast({
        title: "Photo supprimée",
        description: "La photo a été retirée de la fiche.",
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de supprimer la photo.",
        variant: "destructive",
      });
    },
  });

  const reorderPhotosMutation = useMutation({
    mutationFn: async ({ photoIds, newIndex }: { photoIds: number[], newIndex: number }) => {
      const response = await apiRequest("PATCH", `/api/items/${itemId}/photos/reorder`, { photoIds }, {
        "X-User-Id": currentUserId || "",
      });
      return { item: await response.json() as ItemWithPhotos, newIndex };
    },
    onSuccess: ({ item: updatedItem, newIndex }) => {
      queryClient.setQueryData(["/api/items", itemId], updatedItem);
      queryClient.setQueryData(["/api/items"], (oldData: ItemWithPhotos[] | undefined) => {
        if (!oldData) return oldData;
        return oldData.map(i => i.id === itemId ? updatedItem : i);
      });
      setCurrentPhotoIndex(newIndex);
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de réordonner les photos.",
        variant: "destructive",
      });
    },
  });

  const addCommentMutation = useMutation({
    mutationFn: async (text: string) => {
      const response = await apiRequest("POST", `/api/items/${itemId}/comments`, { text }, {
        "X-User-Id": currentUserId || "",
      });
      return await response.json() as CommentWithUser;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/items", itemId, "comments"] });
      setNewComment("");
      toast({
        title: "Commentaire ajouté !",
        description: "Votre souvenir a été partagé.",
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible d'ajouter le commentaire.",
        variant: "destructive",
      });
    },
  });

  const deleteCommentMutation = useMutation({
    mutationFn: async (commentId: number) => {
      await apiRequest("DELETE", `/api/items/${itemId}/comments/${commentId}`, undefined, {
        "X-User-Id": currentUserId || "",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/items", itemId, "comments"] });
      toast({
        title: "Commentaire supprimé",
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de supprimer le commentaire.",
        variant: "destructive",
      });
    },
  });

  const handleAddComment = () => {
    const trimmed = newComment.trim();
    if (!trimmed) return;
    addCommentMutation.mutate(trimmed);
  };

  const handleCommentKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleAddComment();
    }
  };

  const setPreferenceMutation = useMutation({
    mutationFn: async (level: "love" | "maybe" | "no") => {
      const response = await apiRequest("POST", `/api/items/${itemId}/preferences`, { level }, {
        "X-User-Id": currentUserId || "",
      });
      return await response.json() as Preference;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/items", itemId, "preferences", "me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/items", itemId, "preferences"] });
      queryClient.invalidateQueries({ queryKey: ["/api/items", itemId, "comments"] });
      toast({
        title: "Préférence enregistrée !",
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible d'enregistrer la préférence.",
        variant: "destructive",
      });
    },
  });

  const handleSetPreference = (level: "love" | "maybe" | "no") => {
    setPreferenceMutation.mutate(level);
  };

  const deleteItemMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("DELETE", `/api/items/${itemId}`, undefined, {
        "X-User-Id": currentUserId || "",
      });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/items", itemId] });
      queryClient.invalidateQueries({ queryKey: ["/api/items"] });
      toast({
        title: "Fiche supprimée",
        description: "La fiche a été marquée comme supprimée.",
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de supprimer la fiche.",
        variant: "destructive",
      });
    },
  });

  const restoreItemMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("PATCH", `/api/items/${itemId}/restore`, undefined, {
        "X-User-Id": currentUserId || "",
      });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/items", itemId] });
      queryClient.invalidateQueries({ queryKey: ["/api/items"] });
      toast({
        title: "Fiche restaurée !",
        description: "La fiche est de nouveau active.",
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de restaurer la fiche.",
        variant: "destructive",
      });
    },
  });

  const movePhotoUp = () => {
    if (!item || currentPhotoIndex === 0 || reorderPhotosMutation.isPending) return;
    const newPhotos = [...item.photos];
    [newPhotos[currentPhotoIndex - 1], newPhotos[currentPhotoIndex]] = 
      [newPhotos[currentPhotoIndex], newPhotos[currentPhotoIndex - 1]];
    reorderPhotosMutation.mutate({ 
      photoIds: newPhotos.map(p => p.id), 
      newIndex: currentPhotoIndex - 1 
    });
  };

  const movePhotoDown = () => {
    if (!item || currentPhotoIndex === item.photos.length - 1 || reorderPhotosMutation.isPending) return;
    const newPhotos = [...item.photos];
    [newPhotos[currentPhotoIndex], newPhotos[currentPhotoIndex + 1]] = 
      [newPhotos[currentPhotoIndex + 1], newPhotos[currentPhotoIndex]];
    reorderPhotosMutation.mutate({ 
      photoIds: newPhotos.map(p => p.id), 
      newIndex: currentPhotoIndex + 1 
    });
  };

  const handleCameraCapture = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setShowAddDialog(false);

    try {
      const compressedPhoto = await compressImage(file);
      await addPhotoMutation.mutateAsync(compressedPhoto);
    } catch {
      toast({
        title: "Erreur",
        description: "Impossible de traiter l'image.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
      if (cameraInputRef.current) {
        cameraInputRef.current.value = "";
      }
    }
  };

  const handleGalleryImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsProcessing(true);
    setShowAddDialog(false);

    const fileArray = Array.from(files);
    let successCount = 0;

    for (const file of fileArray) {
      try {
        const compressedPhoto = await compressImage(file);
        await addPhotoMutation.mutateAsync(compressedPhoto);
        successCount++;
      } catch {
        // Continue with other files
      }
    }

    if (successCount > 0) {
      toast({
        title: successCount === 1 ? "Photo ajoutée !" : "Photos ajoutées !",
        description: `${successCount} photo(s) ajoutée(s) à la fiche.`,
      });
    }

    setIsProcessing(false);
    if (galleryInputRef.current) {
      galleryInputRef.current.value = "";
    }
  };

  const handleOpenCamera = () => {
    setShowAddDialog(false);
    setTimeout(() => cameraInputRef.current?.click(), 100);
  };

  const handleOpenGallery = () => {
    setShowAddDialog(false);
    setTimeout(() => galleryInputRef.current?.click(), 100);
  };

  const handleDeletePhoto = () => {
    if (!item || item.photos.length <= 1) {
      toast({
        title: "Impossible",
        description: "Une fiche doit avoir au moins une photo.",
        variant: "destructive",
      });
      return;
    }
    const photoToDelete = item.photos[currentPhotoIndex];
    deletePhotoMutation.mutate(photoToDelete.id);
  };

  const goToPrevPhoto = () => {
    if (item && item.photos.length > 1) {
      setCurrentPhotoIndex((prev) => (prev === 0 ? item.photos.length - 1 : prev - 1));
    }
  };

  const goToNextPhoto = () => {
    if (item && item.photos.length > 1) {
      setCurrentPhotoIndex((prev) => (prev === item.photos.length - 1 ? 0 : prev + 1));
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const distance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      setLastPinchDistance(distance);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && lastPinchDistance !== null) {
      const distance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const scale = distance / lastPinchDistance;
      setZoomLevel((prev) => Math.max(0.5, Math.min(4, prev * scale)));
      setLastPinchDistance(distance);
    }
  };

  const handleTouchEnd = () => {
    setLastPinchDistance(null);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-4">
        <Skeleton className="h-10 w-32 mb-4" />
        <Skeleton className="aspect-square w-full rounded-lg mb-4" />
        <Skeleton className="h-6 w-48" />
      </div>
    );
  }

  if (!item) {
    return (
      <div className="min-h-screen bg-background p-4">
        <Button variant="ghost" onClick={() => setLocation("/gallery")} data-testid="button-back">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour
        </Button>
        <Card className="mt-4">
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Fiche non trouvée</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentPhoto = item.photos[currentPhotoIndex];

  return (
    <div className="min-h-screen bg-background">
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleCameraCapture}
        className="hidden"
        data-testid="input-camera-detail"
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleGalleryImport}
        className="hidden"
        data-testid="input-gallery-detail"
      />

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center">Ajouter une photo</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <Button
              variant="outline"
              className="h-20 flex-col gap-2"
              onClick={handleOpenCamera}
              data-testid="button-take-photo-detail"
            >
              <Camera className="w-8 h-8" />
              <span className="text-base">Prendre une photo</span>
            </Button>
            <Button
              variant="outline"
              className="h-20 flex-col gap-2"
              onClick={handleOpenGallery}
              data-testid="button-import-gallery-detail"
            >
              <Image className="w-8 h-8" />
              <span className="text-base">Importer depuis la galerie</span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <header className="sticky top-0 z-50 bg-background border-b">
        <div className="flex items-center gap-4 p-4">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/gallery")} data-testid="button-back">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className={`text-xl font-semibold ${item.deletedAt ? "line-through text-muted-foreground" : ""}`}>#{item.number}</h1>
          {titleValue && <span className={`text-muted-foreground ${item.deletedAt ? "line-through" : ""}`}>- {titleValue}</span>}
        </div>
      </header>

      {item.deletedAt && (
        <div className="bg-red-50 dark:bg-red-950 border-b border-red-200 dark:border-red-800 p-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="font-medium text-red-800 dark:text-red-200">Fiche supprimée</p>
                <p className="text-sm text-red-600 dark:text-red-400">
                  par {item.deletedByName || "Inconnu"} le {formatDeleteDate(item.deletedAt)}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={() => restoreItemMutation.mutate()}
              disabled={restoreItemMutation.isPending}
              className="gap-2 border-green-500 text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-950"
              data-testid="button-restore"
            >
              {restoreItemMutation.isPending ? (
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                <RotateCcw className="w-4 h-4" />
              )}
              Restaurer
            </Button>
          </div>
        </div>
      )}

      <main className="p-4">
        <div className="mb-4">
          {isEditingTitle ? (
            <Input
              ref={titleInputRef}
              value={titleValue}
              onChange={handleTitleChange}
              onBlur={handleTitleBlur}
              onKeyDown={handleTitleKeyDown}
              placeholder="Ajouter un titre..."
              className="text-lg h-12"
              maxLength={100}
              data-testid="input-title"
            />
          ) : (
            <button
              onClick={startEditingTitle}
              className="flex items-center gap-2 text-lg hover-elevate px-3 py-2 rounded-md w-full text-left"
              data-testid="button-edit-title"
            >
              {titleValue ? (
                <span className="font-medium">{titleValue}</span>
              ) : (
                <span className="text-muted-foreground italic">Ajouter un titre...</span>
              )}
              <Pencil className="w-4 h-4 text-muted-foreground" />
            </button>
          )}
        </div>
        <div 
          className="relative bg-muted rounded-lg overflow-hidden mb-4 cursor-pointer group max-h-[50vh] sm:max-h-[40vh] lg:max-h-[35vh]"
          onClick={() => { setZoomLevel(1); setShowLightbox(true); }}
          data-testid="photo-container"
        >
          {currentPhoto && (
            <img
              src={currentPhoto.data}
              alt={`Photo ${currentPhotoIndex + 1} de la fiche #${item.number}`}
              className="w-full h-full object-contain max-h-[50vh] sm:max-h-[40vh] lg:max-h-[35vh]"
              data-testid="img-current-photo"
            />
          )}
          
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
            <ZoomIn className="w-10 h-10 text-white opacity-0 group-hover:opacity-80 transition-opacity" />
          </div>
          
          {item.photos.length > 1 && (
            <div className="absolute inset-0 flex items-center justify-between px-2 pointer-events-none">
              <Button
                variant="secondary"
                size="icon"
                className="opacity-90 shadow-lg pointer-events-auto"
                onClick={(e) => { e.stopPropagation(); goToPrevPhoto(); }}
                data-testid="button-prev-photo"
              >
                <ChevronLeft className="w-5 h-5" />
              </Button>
              <Button
                variant="secondary"
                size="icon"
                className="opacity-90 shadow-lg pointer-events-auto"
                onClick={(e) => { e.stopPropagation(); goToNextPhoto(); }}
                data-testid="button-next-photo"
              >
                <ChevronRight className="w-5 h-5" />
              </Button>
            </div>
          )}
          
          {item.photos.length > 1 && (
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/60 px-3 py-1 rounded-full">
              <span className="text-white text-sm font-medium">
                {currentPhotoIndex + 1} / {item.photos.length}
              </span>
            </div>
          )}
        </div>

        {showLightbox && currentPhoto && (
          <div 
            className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center"
            onClick={() => setShowLightbox(false)}
            data-testid="lightbox"
          >
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-4 right-4 text-white hover:bg-white/20"
              onClick={() => setShowLightbox(false)}
              data-testid="button-close-lightbox"
            >
              <X className="w-6 h-6" />
            </Button>
            
            {item.photos.length > 1 && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20"
                  onClick={(e) => { e.stopPropagation(); goToPrevPhoto(); }}
                  data-testid="button-lightbox-prev"
                >
                  <ChevronLeft className="w-8 h-8" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20"
                  onClick={(e) => { e.stopPropagation(); goToNextPhoto(); }}
                  data-testid="button-lightbox-next"
                >
                  <ChevronRight className="w-8 h-8" />
                </Button>
              </>
            )}
            
            <div 
              className="max-w-[90vw] max-h-[90vh] overflow-auto touch-none"
              onClick={(e) => e.stopPropagation()}
              onWheel={(e) => {
                e.preventDefault();
                const delta = e.deltaY > 0 ? -0.1 : 0.1;
                setZoomLevel((prev) => Math.max(0.5, Math.min(4, prev + delta)));
              }}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              <img
                src={currentPhoto.data}
                alt={`Photo ${currentPhotoIndex + 1} de la fiche #${item.number}`}
                className="transition-transform duration-200 select-none"
                style={{ transform: `scale(${zoomLevel})`, transformOrigin: "center center" }}
                draggable={false}
                data-testid="img-lightbox"
              />
            </div>
            
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                className="text-white hover:bg-white/20"
                onClick={(e) => { e.stopPropagation(); setZoomLevel((prev) => Math.max(0.5, prev - 0.25)); }}
                data-testid="button-zoom-out"
              >
                -
              </Button>
              <span className="text-white text-sm">{Math.round(zoomLevel * 100)}%</span>
              <Button
                variant="ghost"
                size="sm"
                className="text-white hover:bg-white/20"
                onClick={(e) => { e.stopPropagation(); setZoomLevel((prev) => Math.min(4, prev + 0.25)); }}
                data-testid="button-zoom-in"
              >
                +
              </Button>
            </div>
            
            {item.photos.length > 1 && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/50 px-3 py-1 rounded-full">
                <span className="text-white text-sm">
                  {currentPhotoIndex + 1} / {item.photos.length}
                </span>
              </div>
            )}
          </div>
        )}

        {item.photos.length > 1 && (
          <div className="flex justify-center gap-2 mb-4">
            {item.photos.map((photo, index) => (
              <button
                key={photo.id}
                onClick={() => setCurrentPhotoIndex(index)}
                className={`w-3 h-3 rounded-full transition-colors ${
                  index === currentPhotoIndex ? "bg-primary" : "bg-muted-foreground/30"
                }`}
                data-testid={`indicator-photo-${index}`}
              />
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-2 justify-center">
          <Button
            variant="outline"
            onClick={() => setShowAddDialog(true)}
            disabled={isProcessing}
            data-testid="button-add-photo-detail"
          >
            {isProcessing ? (
              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
            ) : (
              <Plus className="w-4 h-4 mr-2" />
            )}
            Ajouter
          </Button>
          
          {item.photos.length > 1 && (
            <>
              <Button
                variant="outline"
                size="icon"
                onClick={movePhotoUp}
                disabled={currentPhotoIndex === 0 || reorderPhotosMutation.isPending}
                data-testid="button-move-photo-up"
              >
                <ArrowUp className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={movePhotoDown}
                disabled={currentPhotoIndex === item.photos.length - 1 || reorderPhotosMutation.isPending}
                data-testid="button-move-photo-down"
              >
                <ArrowDown className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                onClick={handleDeletePhoto}
                disabled={deletePhotoMutation.isPending}
                data-testid="button-delete-photo"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Supprimer
              </Button>
            </>
          )}
        </div>

        <div className="mt-6">
          {isEditingDescription ? (
            <div className="space-y-2">
              <Textarea
                ref={descriptionTextareaRef}
                value={descriptionValue}
                onChange={handleDescriptionChange}
                onBlur={handleDescriptionBlur}
                onKeyDown={handleDescriptionKeyDown}
                placeholder="Décrivez l'objet : dimensions, état, origine..."
                className="min-h-32 text-base"
                data-testid="textarea-description"
              />
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDescriptionBlur}
                  data-testid="button-close-description"
                >
                  Fermer
                </Button>
              </div>
            </div>
          ) : (
            <button
              onClick={startEditingDescription}
              className="flex items-start gap-2 hover-elevate px-3 py-3 rounded-md w-full text-left"
              data-testid="button-edit-description"
            >
              {descriptionValue ? (
                <p className="whitespace-pre-wrap flex-1">{descriptionValue}</p>
              ) : (
                <span className="text-muted-foreground italic">Ajouter une description...</span>
              )}
              <Pencil className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-1" />
            </button>
          )}
        </div>

        <div className="mt-8">
          <h2 className="text-lg font-semibold mb-4">Votre choix</h2>
          {isLoadingPreference ? (
            <div className="flex gap-2">
              <Skeleton className="h-16 flex-1" />
              <Skeleton className="h-16 flex-1" />
              <Skeleton className="h-16 flex-1" />
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              <Button
                variant="outline"
                onClick={() => handleSetPreference("love")}
                disabled={setPreferenceMutation.isPending}
                className={`flex flex-col h-auto py-3 min-h-16 transition-all ${
                  myPreference?.level === "love" 
                    ? "border-2 border-red-500 bg-red-50 dark:bg-red-950 scale-105" 
                    : ""
                }`}
                data-testid="button-preference-love"
              >
                <Heart className={`w-6 h-6 mb-1 ${myPreference?.level === "love" ? "text-red-500 fill-red-500" : "text-red-400"}`} />
                <span className="text-xs text-center">Je le veux !</span>
              </Button>
              <Button
                variant="outline"
                onClick={() => handleSetPreference("maybe")}
                disabled={setPreferenceMutation.isPending}
                className={`flex flex-col h-auto py-3 min-h-16 transition-all ${
                  myPreference?.level === "maybe" 
                    ? "border-2 border-orange-500 bg-orange-50 dark:bg-orange-950 scale-105" 
                    : ""
                }`}
                data-testid="button-preference-maybe"
              >
                <HelpCircle className={`w-6 h-6 mb-1 ${myPreference?.level === "maybe" ? "text-orange-500" : "text-orange-400"}`} />
                <span className="text-xs text-center">Si personne</span>
              </Button>
              <Button
                variant="outline"
                onClick={() => handleSetPreference("no")}
                disabled={setPreferenceMutation.isPending}
                className={`flex flex-col h-auto py-3 min-h-16 transition-all ${
                  myPreference?.level === "no" 
                    ? "border-2 border-gray-500 bg-gray-100 dark:bg-gray-800 scale-105" 
                    : ""
                }`}
                data-testid="button-preference-no"
              >
                <Hand className={`w-6 h-6 mb-1 ${myPreference?.level === "no" ? "text-gray-600" : "text-gray-400"}`} />
                <span className="text-xs text-center">Pas intéressé</span>
              </Button>
            </div>
          )}
        </div>

        <div className="mt-8">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-5 h-5" />
            <h2 className="text-lg font-semibold">Qui veut quoi ?</h2>
          </div>

          {isLoadingAllPreferences ? (
            <div className="space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : (
            <div className="space-y-3" data-testid="section-who-wants-what">
              {(() => {
                const grouped = {
                  love: allPreferences.filter(p => p.level === "love"),
                  maybe: allPreferences.filter(p => p.level === "maybe"),
                  no: allPreferences.filter(p => p.level === "no"),
                };
                const usersWithPreference = allPreferences.map(p => p.userId);
                const notSeen = allUsers.filter(u => !usersWithPreference.includes(u.id));
                const hasConflict = grouped.love.length > 1;

                return (
                  <>
                    {grouped.love.length > 0 && (
                      <div className="flex items-center gap-3" data-testid="prefs-love">
                        <Heart className="w-5 h-5 text-red-500 fill-red-500 flex-shrink-0" />
                        <span className="font-semibold">
                          {grouped.love.map(p => p.user.name).join(", ")}
                        </span>
                      </div>
                    )}
                    {grouped.maybe.length > 0 && (
                      <div className="flex items-center gap-3" data-testid="prefs-maybe">
                        <HelpCircle className="w-5 h-5 text-orange-500 flex-shrink-0" />
                        <span>
                          {grouped.maybe.map(p => p.user.name).join(", ")}
                        </span>
                      </div>
                    )}
                    {grouped.no.length > 0 && (
                      <div className="flex items-center gap-3" data-testid="prefs-no">
                        <Hand className="w-5 h-5 text-gray-500 flex-shrink-0" />
                        <span className="text-muted-foreground">
                          {grouped.no.map(p => p.user.name).join(", ")}
                        </span>
                      </div>
                    )}
                    {notSeen.length > 0 && (
                      <div className="flex items-center gap-3" data-testid="prefs-not-seen">
                        <span className="w-5 h-5 flex items-center justify-center text-muted-foreground flex-shrink-0">?</span>
                        <span className="text-muted-foreground italic">
                          {notSeen.map(u => u.name).join(", ")}
                        </span>
                      </div>
                    )}
                    {hasConflict && (
                      <Card className="border-amber-500 bg-amber-50 dark:bg-amber-950" data-testid="conflict-warning">
                        <CardContent className="py-3 flex items-center gap-3">
                          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                          <span className="font-semibold text-amber-800 dark:text-amber-200">
                            {grouped.love.length} personnes veulent cet objet !
                          </span>
                        </CardContent>
                      </Card>
                    )}
                    {allPreferences.length === 0 && notSeen.length === 0 && (
                      <p className="text-muted-foreground text-center py-4">
                        Personne n'a encore donné son avis.
                      </p>
                    )}
                  </>
                );
              })()}
            </div>
          )}
        </div>

        <div className="mt-8">
          <div className="flex items-center gap-2 mb-4">
            <MessageSquare className="w-5 h-5" />
            <h2 className="text-lg font-semibold">Commentaires</h2>
            <span className="text-muted-foreground text-sm">({comments.length})</span>
          </div>

          {isLoadingComments ? (
            <div className="space-y-3">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : (
            <div className="space-y-3">
              {comments.map((comment) => (
                <Card key={comment.id} data-testid={`comment-${comment.id}`}>
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium">{comment.user.name}</span>
                          <span className="text-muted-foreground text-sm">
                            {comment.createdAt ? formatCommentDate(comment.createdAt.toString()) : ""}
                          </span>
                        </div>
                        <p className="whitespace-pre-wrap">{comment.text}</p>
                      </div>
                      {currentUserId && parseInt(currentUserId) === comment.userId && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteCommentMutation.mutate(comment.id)}
                          disabled={deleteCommentMutation.isPending}
                          data-testid={`button-delete-comment-${comment.id}`}
                        >
                          <Trash2 className="w-4 h-4 text-muted-foreground" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}

              {comments.length === 0 && (
                <p className="text-muted-foreground text-center py-4">
                  Aucun commentaire. Soyez le premier à partager un souvenir !
                </p>
              )}
            </div>
          )}

          <div className="mt-4 flex gap-2">
            <Textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              onKeyDown={handleCommentKeyDown}
              placeholder="Partagez un souvenir, une anecdote..."
              className="min-h-20 text-base flex-1"
              data-testid="textarea-new-comment"
            />
            <Button
              onClick={handleAddComment}
              disabled={!newComment.trim() || addCommentMutation.isPending}
              className="self-end"
              data-testid="button-add-comment"
            >
              {addCommentMutation.isPending ? (
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>

        {!item.deletedAt && (
          <div className="mt-12 pt-6 border-t">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full gap-2 text-red-600 border-red-200 hover:bg-red-50 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-950"
                  data-testid="button-delete-item"
                >
                  <Trash2 className="w-4 h-4" />
                  Supprimer cette fiche
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Supprimer cette fiche ?</AlertDialogTitle>
                  <AlertDialogDescription>
                    La fiche restera visible (barrée) et pourra être restaurée à tout moment.
                    Les préférences et commentaires seront conservés.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel data-testid="button-cancel-delete">Annuler</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => deleteItemMutation.mutate()}
                    className="bg-red-600 hover:bg-red-700"
                    data-testid="button-confirm-delete"
                  >
                    {deleteItemMutation.isPending ? (
                      <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    ) : (
                      "Supprimer"
                    )}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </main>
    </div>
  );
}
