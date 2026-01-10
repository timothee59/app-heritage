import { type User, type InsertUser, type Item, type Photo, type ItemWithPhotos } from "@shared/schema";

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
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private items: Map<number, Item>;
  private photos: Map<number, Photo>;
  private nextUserId: number;
  private nextItemId: number;
  private nextPhotoId: number;

  constructor() {
    this.users = new Map();
    this.items = new Map();
    this.photos = new Map();
    this.nextUserId = 1;
    this.nextItemId = 1;
    this.nextPhotoId = 1;
    
    // Données de test pour la famille
    this.seedTestData();
  }

  private seedTestData() {
    const testUsers: InsertUser[] = [
      { name: "Marie", role: "parent" },
      { name: "Jean", role: "parent" },
      { name: "Sophie", role: "enfant" },
      { name: "Pierre", role: "enfant" },
      { name: "Claire", role: "enfant" },
    ];

    testUsers.forEach((user) => {
      const id = this.nextUserId++;
      this.users.set(id, {
        ...user,
        id,
        createdAt: new Date(),
      });
    });
  }

  // Users
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByName(name: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.name.toLowerCase() === name.toLowerCase(),
    );
  }

  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values()).sort((a, b) => 
      a.name.localeCompare(b.name)
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.nextUserId++;
    const user: User = { 
      ...insertUser, 
      id,
      createdAt: new Date(),
    };
    this.users.set(id, user);
    return user;
  }

  // Items
  async getNextItemNumber(): Promise<number> {
    const allItems = Array.from(this.items.values());
    if (allItems.length === 0) return 1;
    return Math.max(...allItems.map(i => i.number)) + 1;
  }

  async getItem(id: number): Promise<ItemWithPhotos | undefined> {
    const item = this.items.get(id);
    if (!item) return undefined;
    
    const itemPhotos = Array.from(this.photos.values())
      .filter(p => p.itemId === id)
      .sort((a, b) => a.position - b.position);
    
    return { ...item, photos: itemPhotos };
  }

  async getAllItems(): Promise<ItemWithPhotos[]> {
    const allItems = Array.from(this.items.values())
      .sort((a, b) => a.number - b.number); // Plus anciens en premier (ordre croissant)
    
    return allItems.map(item => {
      const itemPhotos = Array.from(this.photos.values())
        .filter(p => p.itemId === item.id)
        .sort((a, b) => a.position - b.position);
      return { ...item, photos: itemPhotos };
    });
  }

  async createItem(createdBy: number, photoData: string): Promise<ItemWithPhotos> {
    const id = this.nextItemId++;
    const number = await this.getNextItemNumber();
    
    const item: Item = {
      id,
      number,
      title: null,
      description: null,
      createdBy,
      createdAt: new Date(),
    };
    this.items.set(id, item);
    
    // Créer la photo associée
    const photo = await this.addPhoto(id, photoData, 0);
    
    return { ...item, photos: [photo] };
  }

  // Photos
  async addPhoto(itemId: number, data: string, position: number): Promise<Photo> {
    const id = this.nextPhotoId++;
    const photo: Photo = {
      id,
      itemId,
      data,
      position,
      createdAt: new Date(),
    };
    this.photos.set(id, photo);
    return photo;
  }
}

export const storage = new MemStorage();
