import { useEffect, useState, useRef, useCallback } from "react";
import { useLocation, useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Camera, Image, Plus, Trash2, ChevronLeft, ChevronRight, ArrowUp, ArrowDown, Pencil } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { ItemWithPhotos } from "@shared/schema";

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
  const titleTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const descriptionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const descriptionTextareaRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    const storedUserId = localStorage.getItem("user_id");
    if (!storedUserId) {
      setLocation("/");
      return;
    }
    setCurrentUserId(storedUserId);
  }, [setLocation]);

  const { data: item, isLoading } = useQuery<ItemWithPhotos>({
    queryKey: ["/api/items", itemId],
    enabled: itemId > 0,
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
          <h1 className="text-xl font-semibold">#{item.number}</h1>
          {titleValue && <span className="text-muted-foreground">- {titleValue}</span>}
        </div>
      </header>

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
        <div className="relative aspect-square bg-muted rounded-lg overflow-hidden mb-4">
          {currentPhoto && (
            <img
              src={currentPhoto.data}
              alt={`Photo ${currentPhotoIndex + 1} de la fiche #${item.number}`}
              className="w-full h-full object-contain"
              data-testid="img-current-photo"
            />
          )}
          
          {item.photos.length > 1 && (
            <>
              <Button
                variant="secondary"
                size="icon"
                className="absolute left-2 top-1/2 -translate-y-1/2 opacity-80"
                onClick={goToPrevPhoto}
                data-testid="button-prev-photo"
              >
                <ChevronLeft className="w-5 h-5" />
              </Button>
              <Button
                variant="secondary"
                size="icon"
                className="absolute right-2 top-1/2 -translate-y-1/2 opacity-80"
                onClick={goToNextPhoto}
                data-testid="button-next-photo"
              >
                <ChevronRight className="w-5 h-5" />
              </Button>
              
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/50 px-3 py-1 rounded-full">
                <span className="text-white text-sm">
                  {currentPhotoIndex + 1} / {item.photos.length}
                </span>
              </div>
            </>
          )}
        </div>

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
      </main>
    </div>
  );
}
