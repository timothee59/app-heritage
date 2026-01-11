import { useEffect, useState, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Camera, Plus, User as UserIcon, RefreshCw, Package, Image, Heart, AlertTriangle, Users, HeartOff, PartyPopper, Eye, Trophy, Hand, X, Trash2, EyeOff } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { User, ItemWithPhotos, ItemWithPhotosAndDeleteInfo, ItemWithPhotosAndLovers, ItemWithUserPreference } from "@shared/schema";

type FilterType = "all" | "my-love" | "user-love" | "conflicts" | "to-review";

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

export default function GalleryPage() {
  const [, setLocation] = useLocation();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [filter, setFilter] = useState<FilterType>("all");
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [showDeleted, setShowDeleted] = useState(true);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
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

  const { data: currentUser } = useQuery<User>({
    queryKey: ["/api/users", currentUserId],
    enabled: !!currentUserId,
  });

  const { data: allUsers = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const response = await fetch("/api/users");
      if (!response.ok) return [];
      return await response.json();
    },
  });

  // Build query params based on filter
  const getQueryUrl = () => {
    if (filter === "my-love") return "/api/items?filter=my-love";
    if (filter === "user-love" && selectedUserId) return `/api/items?filter=user-preferences&userId=${selectedUserId}`;
    if (filter === "conflicts") return "/api/items?filter=conflicts";
    if (filter === "to-review") return "/api/items?filter=to-review";
    return `/api/items?showDeleted=${showDeleted}`;
  };

  const { data: items, isLoading: itemsLoading } = useQuery<(ItemWithPhotosAndDeleteInfo | ItemWithPhotosAndLovers | ItemWithUserPreference)[]>({
    queryKey: ["/api/items", filter, selectedUserId, showDeleted],
    queryFn: async () => {
      const response = await fetch(getQueryUrl(), {
        headers: currentUserId ? { "X-User-Id": currentUserId } : {},
      });
      if (!response.ok) return [];
      return await response.json();
    },
    enabled: filter !== "user-love" || !!selectedUserId,
  });

  // Count deleted items
  const deletedCount = items?.filter(item => "deletedAt" in item && item.deletedAt).length || 0;

  const createItemMutation = useMutation({
    mutationFn: async (photoData: string) => {
      const response = await apiRequest("POST", "/api/items", { photo: photoData }, {
        "X-User-Id": currentUserId || "",
      });
      return await response.json() as ItemWithPhotos;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/items"] });
    },
  });

  const handleCameraCapture = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setShowAddDialog(false);

    try {
      const compressedPhoto = await compressImage(file);
      const item = await createItemMutation.mutateAsync(compressedPhoto);
      toast({
        title: "Fiche créée !",
        description: `Fiche #${item.number} ajoutée au catalogue.`,
      });
    } catch {
      toast({
        title: "Erreur",
        description: "Impossible de créer la fiche.",
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
    let lastNumber = 0;

    for (const file of fileArray) {
      try {
        const compressedPhoto = await compressImage(file);
        const item = await createItemMutation.mutateAsync(compressedPhoto);
        successCount++;
        lastNumber = item.number;
      } catch {
        // Continue avec les autres fichiers
      }
    }

    if (successCount > 0) {
      if (successCount === 1) {
        toast({
          title: "Fiche créée !",
          description: `Fiche #${lastNumber} ajoutée au catalogue.`,
        });
      } else {
        toast({
          title: "Fiches créées !",
          description: `${successCount} fiches ajoutées au catalogue.`,
        });
      }
    } else {
      toast({
        title: "Erreur",
        description: "Impossible d'importer les photos.",
        variant: "destructive",
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

  const handleChangeUser = () => {
    localStorage.removeItem("user_id");
    setLocation("/");
  };

  return (
    <div className="min-h-screen bg-background">
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleCameraCapture}
        className="hidden"
        data-testid="input-camera"
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleGalleryImport}
        className="hidden"
        data-testid="input-gallery"
      />

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center">Ajouter un objet</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <Button
              variant="outline"
              className="h-20 flex-col gap-2"
              onClick={handleOpenCamera}
              data-testid="button-take-photo"
            >
              <Camera className="w-8 h-8" />
              <span className="text-base">Prendre une photo</span>
            </Button>
            <Button
              variant="outline"
              className="h-20 flex-col gap-2"
              onClick={handleOpenGallery}
              data-testid="button-import-gallery"
            >
              <Image className="w-8 h-8" />
              <span className="text-base">Importer depuis la galerie</span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <header className="sticky top-0 z-50 bg-background border-b">
        <div className="flex items-center justify-between gap-4 p-4">
          <h1 className="text-lg font-medium">Mobilier Partagé</h1>
          
          {currentUser && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="outline" 
                  className="gap-2 h-10"
                  data-testid="button-user-menu"
                >
                  <UserIcon className="w-4 h-4" />
                  <span>{currentUser.name}</span>
                  <span className="text-muted-foreground text-sm">
                    ({currentUser.role})
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem disabled className="font-medium">
                  {currentUser.name} ({currentUser.role})
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={handleChangeUser}
                  data-testid="button-change-user"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Changer d'utilisateur
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </header>

      <main className="p-4">
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <Button
            variant={filter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("all")}
            data-testid="filter-all"
          >
            Tous
          </Button>
          <Button
            variant={filter === "my-love" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("my-love")}
            className="gap-1"
            data-testid="filter-my-love"
          >
            <Heart className="w-4 h-4" />
            Mes coups de cœur
          </Button>
          <Button
            variant={filter === "conflicts" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("conflicts")}
            className="gap-1"
            data-testid="filter-conflicts"
          >
            <AlertTriangle className="w-4 h-4" />
            Conflits
          </Button>
          <Button
            variant={filter === "user-love" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("user-love")}
            className="gap-1"
            data-testid="filter-user-love"
          >
            <Users className="w-4 h-4" />
            Par personne
          </Button>
          <Button
            variant={filter === "to-review" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("to-review")}
            className="gap-1"
            data-testid="filter-to-review"
          >
            <Eye className="w-4 h-4" />
            À traiter
            {items && filter === "to-review" && items.length > 0 && (
              <span className="bg-primary-foreground text-primary px-1.5 py-0.5 rounded-full text-xs font-medium ml-1">
                {items.length}
              </span>
            )}
          </Button>
          
          {filter === "all" && (
            <div className="flex items-center gap-2 ml-auto">
              <Switch
                id="show-deleted"
                checked={showDeleted}
                onCheckedChange={setShowDeleted}
                data-testid="toggle-show-deleted"
              />
              <Label htmlFor="show-deleted" className="flex items-center gap-1 text-sm cursor-pointer">
                {showDeleted ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                Supprimées
                {deletedCount > 0 && (
                  <span className="bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full text-xs">
                    {deletedCount}
                  </span>
                )}
              </Label>
            </div>
          )}
        </div>

        {filter === "user-love" && (
          <div className="mb-4">
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger className="w-full max-w-xs" data-testid="select-user">
                <SelectValue placeholder="Choisir une personne..." />
              </SelectTrigger>
              <SelectContent>
                {allUsers.map((user) => (
                  <SelectItem key={user.id} value={user.id.toString()} data-testid={`select-user-${user.id}`}>
                    {user.name} ({user.role})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {itemsLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="aspect-square rounded-lg" />
            ))}
          </div>
        ) : items && items.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {items.map((item) => {
              const isConflictItem = "lovers" in item;
              const hasUserPreference = "userPreference" in item;
              const userPreference = hasUserPreference ? (item as ItemWithUserPreference).userPreference : null;
              const isDeleted = "deletedAt" in item && item.deletedAt;
              return (
                <Card 
                  key={item.id} 
                  className={`overflow-hidden hover-elevate cursor-pointer ${isConflictItem ? "ring-2 ring-amber-500" : ""} ${isDeleted ? "opacity-50" : ""}`}
                  onClick={() => setLocation(`/item/${item.id}`)}
                  data-testid={`card-item-${item.id}`}
                >
                  <div className="aspect-square relative">
                    {item.photos[0] ? (
                      <img
                        src={item.photos[0].data}
                        alt={`Fiche #${item.number}`}
                        className={`w-full h-full object-cover ${isDeleted ? "grayscale" : ""}`}
                      />
                    ) : (
                      <div className="w-full h-full bg-muted flex items-center justify-center">
                        <Package className="w-8 h-8 text-muted-foreground" />
                      </div>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                      <span className={`text-white font-medium text-sm ${isDeleted ? "line-through" : ""}`}>
                        #{item.number}
                      </span>
                      {item.title && (
                        <p className={`text-white/80 text-xs truncate ${isDeleted ? "line-through" : ""}`}>
                          {item.title}
                        </p>
                      )}
                    </div>
                    {isConflictItem && (
                      <div className="absolute top-0 left-0 right-0 bg-amber-500 text-white text-xs p-1 text-center font-medium" data-testid={`conflict-badge-${item.id}`}>
                        {(item as ItemWithPhotosAndLovers).lovers.join(" vs ")}
                      </div>
                    )}
                    {userPreference && !isDeleted && (
                      <div 
                        className="absolute top-2 right-2 w-8 h-8 rounded-full bg-white/90 dark:bg-black/70 flex items-center justify-center shadow-md"
                        data-testid={`preference-badge-${item.id}`}
                      >
                        {userPreference === "love" && <Heart className="w-5 h-5 text-red-500 fill-red-500" />}
                        {userPreference === "maybe" && <Hand className="w-5 h-5 text-orange-500" />}
                        {userPreference === "no" && <X className="w-5 h-5 text-gray-400" />}
                      </div>
                    )}
                    {isDeleted && (
                      <div 
                        className="absolute top-2 right-2 w-8 h-8 rounded-full bg-red-500/80 flex items-center justify-center shadow-md"
                        data-testid={`deleted-badge-${item.id}`}
                      >
                        <Trash2 className="w-5 h-5 text-white" />
                      </div>
                    )}
                    {isDeleted && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-[120%] h-1 bg-red-500 rotate-[-15deg] shadow-sm" />
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        ) : filter === "my-love" ? (
          <Card>
            <CardContent className="py-12 text-center">
              <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <HeartOff className="w-8 h-8 text-muted-foreground" />
              </div>
              <h2 className="text-lg font-medium mb-2">Pas encore de coup de cœur</h2>
              <p className="text-muted-foreground mb-4">
                Parcourez les fiches et marquez celles qui vous plaisent !
              </p>
              <Button variant="outline" onClick={() => setFilter("all")}>
                Voir tous les objets
              </Button>
            </CardContent>
          </Card>
        ) : filter === "conflicts" ? (
          <Card>
            <CardContent className="py-12 text-center">
              <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <PartyPopper className="w-8 h-8 text-muted-foreground" />
              </div>
              <h2 className="text-lg font-medium mb-2">Aucun conflit !</h2>
              <p className="text-muted-foreground mb-4">
                La famille est en harmonie. Personne ne veut le même objet.
              </p>
            </CardContent>
          </Card>
        ) : filter === "to-review" ? (
          <Card>
            <CardContent className="py-12 text-center">
              <div className="mx-auto w-16 h-16 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center mb-4">
                <Trophy className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
              <h2 className="text-lg font-medium mb-2">Bravo !</h2>
              <p className="text-muted-foreground mb-4">
                Vous avez traité toutes les fiches.
              </p>
              <Button variant="outline" onClick={() => setFilter("all")}>
                Voir tous les objets
              </Button>
            </CardContent>
          </Card>
        ) : filter === "user-love" && selectedUserId ? (
          <Card>
            <CardContent className="py-12 text-center">
              <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <Heart className="w-8 h-8 text-muted-foreground" />
              </div>
              <h2 className="text-lg font-medium mb-2">Pas de coup de cœur</h2>
              <p className="text-muted-foreground mb-4">
                Cette personne n'a pas encore marqué d'objets.
              </p>
            </CardContent>
          </Card>
        ) : filter === "user-love" && !selectedUserId ? (
          <Card>
            <CardContent className="py-12 text-center">
              <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <Users className="w-8 h-8 text-muted-foreground" />
              </div>
              <h2 className="text-lg font-medium mb-2">Choisissez une personne</h2>
              <p className="text-muted-foreground">
                Sélectionnez un membre de la famille pour voir ses coups de cœur.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <Camera className="w-8 h-8 text-muted-foreground" />
              </div>
              <h2 className="text-lg font-medium mb-2">Aucun objet photographié</h2>
              <p className="text-muted-foreground mb-4">
                Commencez par prendre une photo pour créer la première fiche.
              </p>
            </CardContent>
          </Card>
        )}
      </main>

      <Button
        size="lg"
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg"
        onClick={() => setShowAddDialog(true)}
        disabled={isProcessing}
        data-testid="button-add-photo"
      >
        {isProcessing ? (
          <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          <Plus className="w-6 h-6" />
        )}
      </Button>
    </div>
  );
}
