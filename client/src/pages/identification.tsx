import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, UserPlus } from "lucide-react";
import type { User } from "@shared/schema";

export default function IdentificationPage() {
  const [, setLocation] = useLocation();
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [isCheckingStoredUser, setIsCheckingStoredUser] = useState(true);

  // Vérifier si l'utilisateur mémorisé existe toujours en base
  useEffect(() => {
    const checkStoredUser = async () => {
      const storedUserId = localStorage.getItem("user_id");
      if (!storedUserId) {
        setIsCheckingStoredUser(false);
        return;
      }

      try {
        const response = await fetch(`/api/users/${storedUserId}`);
        if (response.ok) {
          // L'utilisateur existe, rediriger vers la galerie
          setLocation("/gallery");
        } else {
          // L'utilisateur n'existe plus, effacer le localStorage
          localStorage.removeItem("user_id");
          setIsCheckingStoredUser(false);
        }
      } catch {
        // Erreur réseau, effacer par sécurité
        localStorage.removeItem("user_id");
        setIsCheckingStoredUser(false);
      }
    };

    checkStoredUser();
  }, [setLocation]);

  // Récupérer la liste des utilisateurs
  const { data: users, isLoading, error } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  // Gérer la sélection d'un utilisateur
  const handleSelectUser = () => {
    if (selectedUserId) {
      localStorage.setItem("user_id", selectedUserId);
      setLocation("/gallery");
    }
  };

  // Rediriger vers l'ajout de prénom
  const handleAddName = () => {
    setLocation("/add-user");
  };

  const hasUsers = users && users.length > 0;

  // Afficher un écran de chargement pendant la vérification de l'utilisateur mémorisé
  if (isCheckingStoredUser) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="py-12">
            <div className="flex flex-col items-center gap-4">
              <Skeleton className="h-16 w-16 rounded-full" />
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Users className="w-8 h-8 text-primary" />
          </div>
          <div className="space-y-2">
            <CardTitle className="text-2xl">Héritage Partagé</CardTitle>
            <CardDescription className="text-base">
              Qui êtes-vous ?
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : error ? (
            <div className="text-center text-destructive p-4">
              Une erreur est survenue lors du chargement des utilisateurs.
            </div>
          ) : hasUsers ? (
            <>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger 
                  className="h-12 text-base" 
                  data-testid="select-user-dropdown"
                >
                  <SelectValue placeholder="Choisir un prénom" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((user) => (
                    <SelectItem 
                      key={user.id} 
                      value={user.id.toString()}
                      className="text-base py-3"
                      data-testid={`select-user-option-${user.id}`}
                    >
                      <span className="flex items-center gap-2">
                        {user.name}
                        <span className="text-muted-foreground text-sm">
                          ({user.role})
                        </span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button 
                className="w-full h-12 text-base"
                disabled={!selectedUserId}
                onClick={handleSelectUser}
                data-testid="button-confirm-user"
              >
                C'est moi
              </Button>
            </>
          ) : (
            <div className="text-center space-y-4 py-4">
              <p className="text-muted-foreground">
                Aucun prénom n'a encore été ajouté.
              </p>
              <p className="text-sm text-muted-foreground">
                Commencez par ajouter votre prénom pour utiliser l'application.
              </p>
            </div>
          )}

          <div className="pt-4 border-t">
            <p className="text-center text-sm text-muted-foreground mb-4">
              Pas dans la liste ?
            </p>
            <Button 
              variant="outline" 
              className="w-full h-12 text-base gap-2"
              onClick={handleAddName}
              data-testid="button-add-user"
            >
              <UserPlus className="w-5 h-5" />
              Ajouter mon prénom
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
