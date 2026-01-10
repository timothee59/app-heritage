import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LogOut, Package } from "lucide-react";
import type { User } from "@shared/schema";

export default function GalleryPage() {
  const [, setLocation] = useLocation();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

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
    queryKey: [`/api/users/${currentUserId}`],
    enabled: !!currentUserId,
  });

  // Déconnexion
  const handleLogout = () => {
    localStorage.removeItem("user_id");
    setLocation("/");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background border-b">
        <div className="flex items-center justify-between p-4">
          <div>
            <h1 className="text-lg font-medium">Héritage Partagé</h1>
            {currentUser && (
              <p className="text-sm text-muted-foreground">
                Bonjour, {currentUser.name}
              </p>
            )}
          </div>
          <Button 
            variant="ghost" 
            size="icon"
            onClick={handleLogout}
            data-testid="button-logout"
          >
            <LogOut className="w-5 h-5" />
          </Button>
        </div>
      </header>

      {/* Contenu principal */}
      <main className="p-4">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Package className="w-8 h-8 text-muted-foreground" />
            </div>
            <CardTitle>Bienvenue dans la galerie</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-muted-foreground">
              Le catalogue d'objets sera disponible prochainement.
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Cette fonctionnalité sera développée dans les prochaines stories.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
