import { pgTable, text, varchar, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Utilisateurs (identification simple)
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 50 }).notNull().unique(),
  role: varchar("role", { length: 10 }).notNull(), // 'parent' ou 'enfant'
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  name: true,
  role: true,
}).extend({
  role: z.enum(["parent", "enfant"]),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Fiches (items du catalogue)
export const items = pgTable("items", {
  id: serial("id").primaryKey(),
  number: integer("number").notNull(), // Numéro auto-incrémenté (#1, #2, #3...)
  title: varchar("title", { length: 100 }), // Titre optionnel
  description: text("description"), // Description optionnelle
  createdBy: integer("created_by").notNull(), // ID de l'utilisateur qui a créé
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertItemSchema = createInsertSchema(items).pick({
  createdBy: true,
});

export type InsertItem = z.infer<typeof insertItemSchema>;
export type Item = typeof items.$inferSelect;

// Photos des fiches
export const photos = pgTable("photos", {
  id: serial("id").primaryKey(),
  itemId: integer("item_id").notNull(), // Référence vers la fiche
  data: text("data").notNull(), // Image en base64 (data:image/jpeg;base64,...)
  position: integer("position").notNull().default(0), // Ordre de la photo
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPhotoSchema = createInsertSchema(photos).pick({
  itemId: true,
  data: true,
  position: true,
});

export type InsertPhoto = z.infer<typeof insertPhotoSchema>;
export type Photo = typeof photos.$inferSelect;

// Type combiné pour une fiche avec ses photos
export type ItemWithPhotos = Item & { photos: Photo[] };
