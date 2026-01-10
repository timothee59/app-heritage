import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Users, UserPlus, User, Heart } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { User as UserType } from "@shared/schema";

const addUserSchema = z.object({
  name: z.string().min(2, "Le prénom doit contenir au moins 2 caractères").max(50, "Le prénom ne peut pas dépasser 50 caractères"),
  role: z.enum(["parent", "enfant"], { required_error: "Veuillez choisir un rôle" }),
});

type AddUserForm = z.infer<typeof addUserSchema>;

export default function IdentificationPage() {
  const [, setLocation] = useLocation();
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [isCheckingStoredUser, setIsCheckingStoredUser] = useState(true);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<AddUserForm>({
    resolver: zodResolver(addUserSchema),
    defaultValues: {
      name: "",
      role: undefined,
    },
  });

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
          setLocation("/gallery");
        } else {
          localStorage.removeItem("user_id");
          setIsCheckingStoredUser(false);
        }
      } catch {
        localStorage.removeItem("user_id");
        setIsCheckingStoredUser(false);
      }
    };

    checkStoredUser();
  }, [setLocation]);

  // Récupérer la liste des utilisateurs
  const { data: users, isLoading, error } = useQuery<UserType[]>({
    queryKey: ["/api/users"],
  });

  // Mutation pour créer un utilisateur
  const createUserMutation = useMutation({
    mutationFn: async (data: AddUserForm) => {
      const response = await apiRequest("POST", "/api/users", data);
      return await response.json() as UserType;
    },
    onSuccess: (user) => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      localStorage.setItem("user_id", user.id.toString());
      toast({
        title: "Bienvenue !",
        description: `Votre prénom ${user.name} a été ajouté.`,
      });
      setLocation("/gallery");
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur",
        description: error.message || "Ce prénom existe déjà ou une erreur est survenue.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: AddUserForm) => {
    createUserMutation.mutate(data);
  };

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
  const isFirstUser = !isLoading && !error && !hasUsers;

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

  // Premier utilisateur : afficher le formulaire de création directement
  if (isFirstUser) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Heart className="w-8 h-8 text-primary" />
            </div>
            <div className="space-y-2">
              <CardTitle className="text-2xl">Héritage Partagé</CardTitle>
              <CardDescription className="text-base">
                Bienvenue !
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="text-center space-y-2 p-4 bg-muted/50 rounded-lg">
              <p className="text-foreground font-medium">
                Vous êtes le premier à utiliser l'application.
              </p>
              <p className="text-sm text-muted-foreground">
                Commencez par créer votre profil.
              </p>
            </div>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-base">Votre prénom</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Entrez votre prénom"
                          className="h-12 text-base"
                          data-testid="input-first-user-name"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-base">Vous êtes...</FormLabel>
                      <div className="grid grid-cols-2 gap-4 pt-2">
                        <Button
                          type="button"
                          variant={field.value === "parent" ? "default" : "outline"}
                          className="h-20 flex-col gap-2"
                          onClick={() => field.onChange("parent")}
                          data-testid="button-first-user-role-parent"
                        >
                          <Users className="w-6 h-6" />
                          <span className="text-base">Parent</span>
                        </Button>
                        <Button
                          type="button"
                          variant={field.value === "enfant" ? "default" : "outline"}
                          className="h-20 flex-col gap-2"
                          onClick={() => field.onChange("enfant")}
                          data-testid="button-first-user-role-enfant"
                        >
                          <User className="w-6 h-6" />
                          <span className="text-base">Enfant</span>
                        </Button>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full h-12 text-base"
                  disabled={createUserMutation.isPending}
                  data-testid="button-first-user-submit"
                >
                  {createUserMutation.isPending ? "Création en cours..." : "Commencer"}
                </Button>
              </form>
            </Form>
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
          ) : (
            <>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger 
                  className="h-12 text-base" 
                  data-testid="select-user-dropdown"
                >
                  <SelectValue placeholder="Choisir un prénom" />
                </SelectTrigger>
                <SelectContent>
                  {users?.map((user) => (
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
