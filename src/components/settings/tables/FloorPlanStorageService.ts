import { Table } from '@/types/table';
import { FloorPlanObject } from '@/types/floorplan';

export interface FloorPlanLayout {
  id: string;
  name: string;
  level: number;
  tables: Table[];
  objects: FloorPlanObject[];
  metadata: {
    totalSeats: number;
    totalTables: number;
    createdAt: string;
    updatedAt: string;
  };
}

export interface FloorLevel {
  id: string;
  name: string;
  level: number;
  isActive: boolean;
  layout?: FloorPlanLayout;
}

class FloorPlanStorageService {
  private storageKey = 'floor_plan_layouts';
  private levelsKey = 'floor_plan_levels';

  // Floor Level Management
  getLevels(): FloorLevel[] {
    const stored = localStorage.getItem(this.levelsKey);
    if (!stored) {
      const defaultLevel: FloorLevel = {
        id: 'level-1',
        name: 'Ground Floor',
        level: 1,
        isActive: true
      };
      this.saveLevels([defaultLevel]);
      return [defaultLevel];
    }
    return JSON.parse(stored);
  }

  saveLevels(levels: FloorLevel[]): void {
    localStorage.setItem(this.levelsKey, JSON.stringify(levels));
  }

  createLevel(name: string): FloorLevel {
    const levels = this.getLevels();
    const maxLevel = Math.max(...levels.map(l => l.level), 0);
    const newLevel: FloorLevel = {
      id: `level-${Date.now()}`,
      name,
      level: maxLevel + 1,
      isActive: false
    };
    
    levels.push(newLevel);
    this.saveLevels(levels);
    return newLevel;
  }

  deleteLevel(levelId: string): void {
    const levels = this.getLevels().filter(l => l.id !== levelId);
    this.saveLevels(levels);
    // Also remove any layouts for this level
    this.deleteLayoutsForLevel(levelId);
  }

  // Layout Management
  getLayouts(): FloorPlanLayout[] {
    const stored = localStorage.getItem(this.storageKey);
    return stored ? JSON.parse(stored) : [];
  }

  saveLayout(layout: Omit<FloorPlanLayout, 'id' | 'metadata'>, tables: Table[]): FloorPlanLayout {
    const layouts = this.getLayouts();
    
    // Filter tables for this specific floor level
    const floorTables = tables.filter(t => (t.floor_level || 1) === layout.level);
    
    const newLayout: FloorPlanLayout = {
      ...layout,
      tables: floorTables, // Use floor-specific tables
      id: `layout-${Date.now()}`,
      metadata: {
        totalSeats: floorTables.reduce((sum, t) => sum + t.seats, 0),
        totalTables: floorTables.length,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    };

    const existingIndex = layouts.findIndex(l => l.level === layout.level);
    if (existingIndex >= 0) {
      layouts[existingIndex] = newLayout;
    } else {
      layouts.push(newLayout);
    }

    localStorage.setItem(this.storageKey, JSON.stringify(layouts));
    return newLayout;
  }

  getLayoutForLevel(level: number): FloorPlanLayout | null {
    const layouts = this.getLayouts();
    return layouts.find(l => l.level === level) || null;
  }

  deleteLayoutsForLevel(levelId: string): void {
    const levels = this.getLevels();
    const level = levels.find(l => l.id === levelId);
    if (!level) return;

    const layouts = this.getLayouts().filter(l => l.level !== level.level);
    localStorage.setItem(this.storageKey, JSON.stringify(layouts));
  }

  exportLayout(layout: FloorPlanLayout): string {
    return JSON.stringify(layout, null, 2);
  }

  importLayout(jsonData: string, tables: Table[]): FloorPlanLayout {
    const layout = JSON.parse(jsonData) as FloorPlanLayout;
    return this.saveLayout(layout, tables);
  }

  clearAll(): void {
    localStorage.removeItem(this.storageKey);
    localStorage.removeItem(this.levelsKey);
  }
}

export const floorPlanStorage = new FloorPlanStorageService();