import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Trash2, RotateCcw, Package } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { User, ItemWithPhotosAndDeleteInfo } from "@shared/schema";

export default function DeletedItemsPage() {
  const [, setLocation] = useLocation();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
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

  const { data: allUsers = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const response = await fetch("/api/users");
      if (!response.ok) return [];
      return await response.json();
    },
  });

  const { data: items, isLoading } = useQuery<ItemWithPhotosAndDeleteInfo[]>({
    queryKey: ["/api/items", "deleted"],
    queryFn: async () => {
      const response = await fetch("/api/items?filter=deleted", {
        headers: currentUserId ? { "X-User-Id": currentUserId } : {},
      });
      if (!response.ok) return [];
      const data = await response.json();
      return data.sort((a: ItemWithPhotosAndDeleteInfo, b: ItemWithPhotosAndDeleteInfo) => {
        const dateA = a.deletedAt ? new Date(a.deletedAt).getTime() : 0;
        const dateB = b.deletedAt ? new Date(b.deletedAt).getTime() : 0;
        return dateB - dateA;
      });
    },
    enabled: !!currentUserId,
  });

  const restoreMutation = useMutation({
    mutationFn: async (itemId: number) => {
      const response = await apiRequest("PUT", `/api/items/${itemId}/restore`, {}, {
        "X-User-Id": currentUserId || "",
      });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/items", "deleted"] });
      toast({
        title: "Fiche restaurée",
        description: "La fiche a été restaurée avec succès",
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de restaurer la fiche",
        variant: "destructive",
      });
    },
  });

  const getUserName = (userId: number | null | undefined) => {
    if (!userId) return "Inconnu";
    const user = allUsers.find(u => u.id === userId);
    return user?.name || "Inconnu";
  };

  const formatDate = (dateVal: Date | string | null | undefined) => {
    if (!dateVal) return "";
    const date = typeof dateVal === "string" ? new Date(dateVal) : dateVal;
    return date.toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-background border-b px-4 py-3">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            className="w-12 h-12"
            onClick={() => setLocation("/gallery")}
            data-testid="button-back-gallery"
          >
            <ArrowLeft className="w-7 h-7" />
          </Button>
          <div className="flex items-center gap-3">
            <Trash2 className="w-7 h-7 text-muted-foreground" />
            <h1 className="text-xl font-semibold">Corbeille</h1>
          </div>
        </div>
      </header>

      <main className="p-4">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-48 rounded-lg" />
            ))}
          </div>
        ) : items && items.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((item) => (
              <Card 
                key={item.id} 
                className="overflow-hidden"
                data-testid={`card-deleted-item-${item.id}`}
              >
                <div className="flex">
                  <div className="w-32 h-32 flex-shrink-0 relative">
                    {item.photos[0] ? (
                      <img
                        src={item.photos[0].data}
                        alt={`Fiche #${item.number}`}
                        className="w-full h-full object-cover grayscale"
                      />
                    ) : (
                      <div className="w-full h-full bg-muted flex items-center justify-center">
                        <Package className="w-8 h-8 text-muted-foreground" />
                      </div>
                    )}
                    <div className="absolute top-1 left-1 bg-red-500/80 text-white text-xs px-2 py-0.5 rounded font-medium">
                      #{item.number}
                    </div>
                  </div>
                  <CardContent className="flex-1 p-3 flex flex-col justify-between">
                    <div>
                      <p className="font-medium text-base line-through text-muted-foreground">
                        {item.title || `Fiche #${item.number}`}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Supprimé par {getUserName(item.deletedBy)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(item.deletedAt)}
                      </p>
                    </div>
                    <Button
                      variant="default"
                      className="mt-2 h-12 text-base gap-2"
                      onClick={() => restoreMutation.mutate(item.id)}
                      disabled={restoreMutation.isPending}
                      data-testid={`button-restore-${item.id}`}
                    >
                      <RotateCcw className="w-5 h-5" />
                      Restaurer
                    </Button>
                  </CardContent>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-4">
              <Trash2 className="w-10 h-10 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Aucune fiche dans la corbeille</h2>
            <p className="text-muted-foreground mb-6 max-w-sm">
              Les fiches supprimées apparaîtront ici. Vous pourrez les restaurer si besoin.
            </p>
            <Button
              variant="outline"
              className="h-12 px-6 text-base"
              onClick={() => setLocation("/gallery")}
              data-testid="button-return-gallery"
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              Retour à la galerie
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
