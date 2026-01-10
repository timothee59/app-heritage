import { useEffect, useState, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Camera, Plus, User as UserIcon, RefreshCw, Package } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { User, ItemWithPhotos } from "@shared/schema";

// Compression d'image
const MAX_WIDTH = 1200;
const MAX_HEIGHT = 1200;
const QUALITY = 0.8;

function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Vérifier si l'utilisateur est identifié
  useEffect(() => {
    const storedUserId = localStorage.getItem("user_id");
    if (!storedUserId) {
      setLocation("/");
      return;
    }
    setCurrentUserId(storedUserId);
  }, [setLocation]);

  // Récupérer les infos de l'utilisateur courant
  const { data: currentUser } = useQuery<User>({
    queryKey: ["/api/users", currentUserId],
    enabled: !!currentUserId,
  });

  // Récupérer tous les items
  const { data: items, isLoading: itemsLoading } = useQuery<ItemWithPhotos[]>({
    queryKey: ["/api/items"],
  });

  // Mutation pour créer un item
  const createItemMutation = useMutation({
    mutationFn: async (photoData: string) => {
      const response = await apiRequest("POST", "/api/items", { photo: photoData }, {
        "X-User-Id": currentUserId || "",
      });
      return await response.json() as ItemWithPhotos;
    },
    onSuccess: (item) => {
      queryClient.invalidateQueries({ queryKey: ["/api/items"] });
      toast({
        title: "Fiche créée !",
        description: `Fiche #${item.number} ajoutée au catalogue.`,
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de créer la fiche.",
        variant: "destructive",
      });
    },
  });

  // Gérer la capture de photo
  const handleCapture = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const compressedPhoto = await compressImage(file);
      createItemMutation.mutate(compressedPhoto);
    } catch {
      toast({
        title: "Erreur",
        description: "Impossible de traiter l'image.",
        variant: "destructive",
      });
    }

    // Reset l'input pour permettre de reprendre la même photo
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Ouvrir la caméra
  const handleOpenCamera = () => {
    fileInputRef.current?.click();
  };

  // Changer d'utilisateur
  const handleChangeUser = () => {
    localStorage.removeItem("user_id");
    setLocation("/");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Input caché pour la caméra */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleCapture}
        className="hidden"
        data-testid="input-camera"
      />

      {/* Header */}
      <header className="sticky top-0 z-50 bg-background border-b">
        <div className="flex items-center justify-between gap-4 p-4">
          <h1 className="text-lg font-medium">Héritage Partagé</h1>
          
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

      {/* Contenu principal */}
      <main className="p-4">
        {itemsLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="aspect-square rounded-lg" />
            ))}
          </div>
        ) : items && items.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {items.map((item) => (
              <Card 
                key={item.id} 
                className="overflow-hidden hover-elevate cursor-pointer"
                data-testid={`card-item-${item.id}`}
              >
                <div className="aspect-square relative">
                  {item.photos[0] ? (
                    <img
                      src={item.photos[0].data}
                      alt={`Fiche #${item.number}`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-muted flex items-center justify-center">
                      <Package className="w-8 h-8 text-muted-foreground" />
                    </div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                    <span className="text-white font-medium text-sm">
                      #{item.number}
                    </span>
                    {item.title && (
                      <p className="text-white/80 text-xs truncate">
                        {item.title}
                      </p>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
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

      {/* Bouton flottant pour ajouter */}
      <Button
        size="lg"
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg"
        onClick={handleOpenCamera}
        disabled={createItemMutation.isPending}
        data-testid="button-add-photo"
      >
        {createItemMutation.isPending ? (
          <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          <Plus className="w-6 h-6" />
        )}
      </Button>
    </div>
  );
}
