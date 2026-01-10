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

  // Récupérer tous les items (fiches)
  app.get("/api/items", async (_req, res) => {
    try {
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

  return httpServer;
}
