import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertUserSchema } from "@shared/schema";
import { z } from "zod";

// Schema pour la création d'item avec photo
const createItemSchema = z.object({
  photo: z.string().min(1, "Photo requise"),
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Récupérer tous les utilisateurs
  app.get("/api/users", async (_req, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      res.status(500).json({ message: "Erreur lors de la récupération des utilisateurs" });
    }
  });

  // Récupérer un utilisateur par ID
  app.get("/api/users/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "ID invalide" });
      }
      const user = await storage.getUser(id);
      if (!user) {
        return res.status(404).json({ message: "Utilisateur non trouvé" });
      }
      res.json(user);
    } catch (error) {
      res.status(500).json({ message: "Erreur lors de la récupération de l'utilisateur" });
    }
  });

  // Créer un nouvel utilisateur
  app.post("/api/users", async (req, res) => {
    try {
      const result = insertUserSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Données invalides", errors: result.error.errors });
      }

      // Vérifier si le prénom existe déjà
      const existingUser = await storage.getUserByName(result.data.name);
      if (existingUser) {
        return res.status(409).json({ message: "Ce prénom existe déjà" });
      }

      const user = await storage.createUser(result.data);
      res.status(201).json(user);
    } catch (error) {
      res.status(500).json({ message: "Erreur lors de la création de l'utilisateur" });
    }
  });

  // Récupérer tous les items (fiches) avec filtres optionnels
  app.get("/api/items", async (req, res) => {
    try {
      const filter = req.query.filter as string | undefined;
      const filterUserId = req.query.userId ? parseInt(req.query.userId as string) : undefined;
      const currentUserId = parseInt(req.headers["x-user-id"] as string);

      // Filtre "my-love" : mes coups de cœur
      if (filter === "my-love") {
        if (isNaN(currentUserId)) {
          return res.status(401).json({ message: "Utilisateur non identifié" });
        }
        const items = await storage.getItemsByUserPreference(currentUserId, "love");
        return res.json(items);
      }

      // Filtre "user-love" : coups de cœur d'un autre utilisateur
      if (filter === "user-love" && filterUserId) {
        const items = await storage.getItemsByUserPreference(filterUserId, "love");
        return res.json(items);
      }

      // Filtre "user-preferences" : tous les avis d'un utilisateur avec indicateurs
      if (filter === "user-preferences" && filterUserId) {
        const items = await storage.getItemsByUserAllPreferences(filterUserId);
        return res.json(items);
      }

      // Filtre "conflicts" : fiches avec 2+ coups de cœur
      if (filter === "conflicts") {
        const items = await storage.getItemsWithConflicts();
        return res.json(items);
      }

      // Filtre "to-review" : fiches sans préférence de l'utilisateur
      if (filter === "to-review") {
        if (isNaN(currentUserId)) {
          return res.status(401).json({ message: "Utilisateur non identifié" });
        }
        const items = await storage.getItemsWithoutPreference(currentUserId);
        return res.json(items);
      }

      // Par défaut : toutes les fiches
      const items = await storage.getAllItems();
      res.json(items);
    } catch (error) {
      res.status(500).json({ message: "Erreur lors de la récupération des fiches" });
    }
  });

  // Récupérer un item par ID
  app.get("/api/items/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "ID invalide" });
      }
      const item = await storage.getItem(id);
      if (!item) {
        return res.status(404).json({ message: "Fiche non trouvée" });
      }
      res.json(item);
    } catch (error) {
      res.status(500).json({ message: "Erreur lors de la récupération de la fiche" });
    }
  });

  // Mettre à jour une fiche (titre, description)
  app.patch("/api/items/:id", async (req, res) => {
    try {
      const userId = parseInt(req.headers["x-user-id"] as string);
      if (isNaN(userId)) {
        return res.status(401).json({ message: "Utilisateur non identifié" });
      }
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(401).json({ message: "Utilisateur non trouvé" });
      }

      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "ID invalide" });
      }

      const updateSchema = z.object({
        title: z.string().max(100).nullable().optional(),
        description: z.string().nullable().optional(),
      });

      const result = updateSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Données invalides", errors: result.error.errors });
      }

      const updatedItem = await storage.updateItem(id, result.data);
      if (!updatedItem) {
        return res.status(404).json({ message: "Fiche non trouvée" });
      }

      res.json(updatedItem);
    } catch (error) {
      res.status(500).json({ message: "Erreur lors de la mise à jour de la fiche" });
    }
  });

  // Créer un nouvel item (fiche) avec photo
  app.post("/api/items", async (req, res) => {
    try {
      // Récupérer l'ID utilisateur depuis le header
      const userId = parseInt(req.headers["x-user-id"] as string);
      if (isNaN(userId)) {
        return res.status(401).json({ message: "Utilisateur non identifié" });
      }

      // Vérifier que l'utilisateur existe
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(401).json({ message: "Utilisateur non trouvé" });
      }

      // Valider les données
      const result = createItemSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Données invalides", errors: result.error.errors });
      }

      // Créer la fiche avec la photo
      const item = await storage.createItem(userId, result.data.photo);
      res.status(201).json(item);
    } catch (error) {
      res.status(500).json({ message: "Erreur lors de la création de la fiche" });
    }
  });

  // Ajouter une photo à une fiche existante
  app.post("/api/items/:itemId/photos", async (req, res) => {
    try {
      // Vérifier l'authentification
      const userId = parseInt(req.headers["x-user-id"] as string);
      if (isNaN(userId)) {
        return res.status(401).json({ message: "Utilisateur non identifié" });
      }
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(401).json({ message: "Utilisateur non trouvé" });
      }

      const itemId = parseInt(req.params.itemId);
      if (isNaN(itemId)) {
        return res.status(400).json({ message: "ID de fiche invalide" });
      }

      const item = await storage.getItem(itemId);
      if (!item) {
        return res.status(404).json({ message: "Fiche non trouvée" });
      }

      const result = createItemSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Données invalides", errors: result.error.errors });
      }

      const position = await storage.getNextPhotoPosition(itemId);
      const photo = await storage.addPhoto(itemId, result.data.photo, position);
      res.status(201).json(photo);
    } catch (error) {
      res.status(500).json({ message: "Erreur lors de l'ajout de la photo" });
    }
  });

  // Supprimer une photo d'une fiche
  app.delete("/api/items/:itemId/photos/:photoId", async (req, res) => {
    try {
      // Vérifier l'authentification
      const userId = parseInt(req.headers["x-user-id"] as string);
      if (isNaN(userId)) {
        return res.status(401).json({ message: "Utilisateur non identifié" });
      }
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(401).json({ message: "Utilisateur non trouvé" });
      }

      const itemId = parseInt(req.params.itemId);
      const photoId = parseInt(req.params.photoId);
      
      if (isNaN(itemId) || isNaN(photoId)) {
        return res.status(400).json({ message: "ID invalide" });
      }

      const item = await storage.getItem(itemId);
      if (!item) {
        return res.status(404).json({ message: "Fiche non trouvée" });
      }

      // Vérifier que la photo appartient à cette fiche
      const photoExists = item.photos.some(p => p.id === photoId);
      if (!photoExists) {
        return res.status(404).json({ message: "Photo non trouvée dans cette fiche" });
      }

      // Vérifier qu'il reste au moins une photo
      if (item.photos.length <= 1) {
        return res.status(400).json({ message: "Une fiche doit avoir au moins une photo" });
      }

      const deleted = await storage.deletePhoto(photoId);
      if (!deleted) {
        return res.status(404).json({ message: "Photo non trouvée" });
      }

      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Erreur lors de la suppression de la photo" });
    }
  });

  // Réordonner les photos d'une fiche
  app.patch("/api/items/:itemId/photos/reorder", async (req, res) => {
    try {
      // Vérifier l'authentification
      const userId = parseInt(req.headers["x-user-id"] as string);
      if (isNaN(userId)) {
        return res.status(401).json({ message: "Utilisateur non identifié" });
      }
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(401).json({ message: "Utilisateur non trouvé" });
      }

      const itemId = parseInt(req.params.itemId);
      if (isNaN(itemId)) {
        return res.status(400).json({ message: "ID de fiche invalide" });
      }

      const item = await storage.getItem(itemId);
      if (!item) {
        return res.status(404).json({ message: "Fiche non trouvée" });
      }

      const { photoIds } = req.body;
      if (!Array.isArray(photoIds)) {
        return res.status(400).json({ message: "photoIds doit être un tableau" });
      }

      await storage.reorderPhotos(itemId, photoIds);
      const updatedItem = await storage.getItem(itemId);
      res.json(updatedItem);
    } catch (error) {
      res.status(500).json({ message: "Erreur lors du réordonnancement des photos" });
    }
  });

  // Récupérer les commentaires d'une fiche
  app.get("/api/items/:itemId/comments", async (req, res) => {
    try {
      const itemId = parseInt(req.params.itemId);
      if (isNaN(itemId)) {
        return res.status(400).json({ message: "ID de fiche invalide" });
      }

      const item = await storage.getItem(itemId);
      if (!item) {
        return res.status(404).json({ message: "Fiche non trouvée" });
      }

      const comments = await storage.getCommentsByItemId(itemId);
      res.json(comments);
    } catch (error) {
      res.status(500).json({ message: "Erreur lors de la récupération des commentaires" });
    }
  });

  // Ajouter un commentaire à une fiche
  app.post("/api/items/:itemId/comments", async (req, res) => {
    try {
      const userId = parseInt(req.headers["x-user-id"] as string);
      if (isNaN(userId)) {
        return res.status(401).json({ message: "Utilisateur non identifié" });
      }
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(401).json({ message: "Utilisateur non trouvé" });
      }

      const itemId = parseInt(req.params.itemId);
      if (isNaN(itemId)) {
        return res.status(400).json({ message: "ID de fiche invalide" });
      }

      const item = await storage.getItem(itemId);
      if (!item) {
        return res.status(404).json({ message: "Fiche non trouvée" });
      }

      const commentSchema = z.object({
        text: z.string().min(1, "Le commentaire ne peut pas être vide"),
      });

      const result = commentSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Données invalides", errors: result.error.errors });
      }

      const comment = await storage.createComment(itemId, userId, result.data.text);
      res.status(201).json(comment);
    } catch (error) {
      res.status(500).json({ message: "Erreur lors de l'ajout du commentaire" });
    }
  });

  // Supprimer un commentaire (uniquement par son auteur)
  app.delete("/api/items/:itemId/comments/:commentId", async (req, res) => {
    try {
      const userId = parseInt(req.headers["x-user-id"] as string);
      if (isNaN(userId)) {
        return res.status(401).json({ message: "Utilisateur non identifié" });
      }
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(401).json({ message: "Utilisateur non trouvé" });
      }

      const itemId = parseInt(req.params.itemId);
      const commentId = parseInt(req.params.commentId);
      
      if (isNaN(itemId) || isNaN(commentId)) {
        return res.status(400).json({ message: "ID invalide" });
      }

      const deleted = await storage.deleteComment(commentId, userId);
      if (!deleted) {
        return res.status(403).json({ message: "Vous ne pouvez supprimer que vos propres commentaires" });
      }

      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Erreur lors de la suppression du commentaire" });
    }
  });

  // Récupérer la préférence de l'utilisateur courant pour une fiche
  app.get("/api/items/:itemId/preferences/me", async (req, res) => {
    try {
      const userId = parseInt(req.headers["x-user-id"] as string);
      if (isNaN(userId)) {
        return res.status(401).json({ message: "Utilisateur non identifié" });
      }
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(401).json({ message: "Utilisateur non trouvé" });
      }

      const itemId = parseInt(req.params.itemId);
      if (isNaN(itemId)) {
        return res.status(400).json({ message: "ID de fiche invalide" });
      }

      const preference = await storage.getPreferenceByItemAndUser(itemId, userId);
      res.json(preference || null);
    } catch (error) {
      res.status(500).json({ message: "Erreur lors de la récupération de la préférence" });
    }
  });

  // Récupérer toutes les préférences d'une fiche
  app.get("/api/items/:itemId/preferences", async (req, res) => {
    try {
      const itemId = parseInt(req.params.itemId);
      if (isNaN(itemId)) {
        return res.status(400).json({ message: "ID de fiche invalide" });
      }

      const item = await storage.getItem(itemId);
      if (!item) {
        return res.status(404).json({ message: "Fiche non trouvée" });
      }

      const preferences = await storage.getPreferencesByItemId(itemId);
      res.json(preferences);
    } catch (error) {
      res.status(500).json({ message: "Erreur lors de la récupération des préférences" });
    }
  });

  // Définir ou mettre à jour sa préférence pour une fiche
  app.post("/api/items/:itemId/preferences", async (req, res) => {
    try {
      const userId = parseInt(req.headers["x-user-id"] as string);
      if (isNaN(userId)) {
        return res.status(401).json({ message: "Utilisateur non identifié" });
      }
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(401).json({ message: "Utilisateur non trouvé" });
      }

      const itemId = parseInt(req.params.itemId);
      if (isNaN(itemId)) {
        return res.status(400).json({ message: "ID de fiche invalide" });
      }

      const item = await storage.getItem(itemId);
      if (!item) {
        return res.status(404).json({ message: "Fiche non trouvée" });
      }

      const preferenceSchema = z.object({
        level: z.enum(["love", "maybe", "no"]),
      });

      const result = preferenceSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Données invalides", errors: result.error.errors });
      }

      // Vérifier si la préférence a changé
      const existingPreference = await storage.getPreferenceByItemAndUser(itemId, userId);
      const hasChanged = !existingPreference || existingPreference.level !== result.data.level;

      const preference = await storage.upsertPreference(itemId, userId, result.data.level);

      // Ajouter un commentaire automatique si la préférence a changé
      if (hasChanged) {
        let commentText = "";
        switch (result.data.level) {
          case "love":
            commentText = `${user.name} a un coup de cœur !`;
            break;
          case "maybe":
            commentText = `${user.name} le veut bien si personne d'autre.`;
            break;
          case "no":
            commentText = `${user.name} n'en veut pas.`;
            break;
        }
        await storage.createComment(itemId, userId, commentText);
      }

      res.status(200).json(preference);
    } catch (error) {
      res.status(500).json({ message: "Erreur lors de l'enregistrement de la préférence" });
    }
  });

  return httpServer;
}
