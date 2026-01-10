import { type User, type InsertUser, type Item, type Photo, type ItemWithPhotos, users, items, photos } from "@shared/schema";
import { db } from "./db";
import { eq, asc, desc, max } from "drizzle-orm";

// Interface de stockage pour les opérations CRUD
export interface IStorage {
  // Users
  getUser(id: number): Promise<User | undefined>;
  getUserByName(name: string): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  
  // Items
  getItem(id: number): Promise<ItemWithPhotos | undefined>;
  getAllItems(): Promise<ItemWithPhotos[]>;
  createItem(createdBy: number, photoData: string): Promise<ItemWithPhotos>;
  getNextItemNumber(): Promise<number>;
  
  // Photos
  addPhoto(itemId: number, data: string, position: number): Promise<Photo>;
  deletePhoto(photoId: number): Promise<boolean>;
  getPhotosByItemId(itemId: number): Promise<Photo[]>;
  getNextPhotoPosition(itemId: number): Promise<number>;
  reorderPhotos(itemId: number, photoIds: number[]): Promise<void>;
}

// DatabaseStorage - Utilise PostgreSQL via Drizzle ORM
export class DatabaseStorage implements IStorage {
  // Users
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByName(name: string): Promise<User | undefined> {
    const allUsers = await db.select().from(users);
    return allUsers.find(u => u.name.toLowerCase() === name.toLowerCase());
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users).orderBy(asc(users.name));
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  // Items
  async getNextItemNumber(): Promise<number> {
    const result = await db.select({ maxNum: max(items.number) }).from(items);
    return (result[0]?.maxNum ?? 0) + 1;
  }

  async getItem(id: number): Promise<ItemWithPhotos | undefined> {
    const [item] = await db.select().from(items).where(eq(items.id, id));
    if (!item) return undefined;
    
    const itemPhotos = await db.select().from(photos)
      .where(eq(photos.itemId, id))
      .orderBy(asc(photos.position));
    
    return { ...item, photos: itemPhotos };
  }

  async getAllItems(): Promise<ItemWithPhotos[]> {
    const allItems = await db.select().from(items).orderBy(asc(items.number));
    
    const result: ItemWithPhotos[] = [];
    for (const item of allItems) {
      const itemPhotos = await db.select().from(photos)
        .where(eq(photos.itemId, item.id))
        .orderBy(asc(photos.position));
      result.push({ ...item, photos: itemPhotos });
    }
    
    return result;
  }

  async createItem(createdBy: number, photoData: string): Promise<ItemWithPhotos> {
    const number = await this.getNextItemNumber();
    
    const [item] = await db.insert(items).values({
      number,
      createdBy,
      title: null,
      description: null,
    }).returning();
    
    const photo = await this.addPhoto(item.id, photoData, 0);
    
    return { ...item, photos: [photo] };
  }

  // Photos
  async addPhoto(itemId: number, data: string, position: number): Promise<Photo> {
    const [photo] = await db.insert(photos).values({
      itemId,
      data,
      position,
    }).returning();
    return photo;
  }

  async deletePhoto(photoId: number): Promise<boolean> {
    const result = await db.delete(photos).where(eq(photos.id, photoId)).returning();
    return result.length > 0;
  }

  async getPhotosByItemId(itemId: number): Promise<Photo[]> {
    return db.select().from(photos)
      .where(eq(photos.itemId, itemId))
      .orderBy(asc(photos.position));
  }

  async getNextPhotoPosition(itemId: number): Promise<number> {
    const result = await db.select({ maxPos: max(photos.position) })
      .from(photos)
      .where(eq(photos.itemId, itemId));
    return (result[0]?.maxPos ?? -1) + 1;
  }

  async reorderPhotos(itemId: number, photoIds: number[]): Promise<void> {
    for (let i = 0; i < photoIds.length; i++) {
      await db.update(photos)
        .set({ position: i })
        .where(eq(photos.id, photoIds[i]));
    }
  }
}

export const storage = new DatabaseStorage();
