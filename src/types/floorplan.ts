export type FloorPlanObjectType = 
  | 'table' | 'bar' | 'bar-stool' | 'booth'
  | 'high-table' | 'waiting-bench' | 'host-stand' | 'service-station' | 'storage'
  | 'wall' | 'door' | 'window' | 'column' | 'kitchen-area' | 'restroom'
  | 'outdoor-table' | 'emergency-exit' | 'accessibility-path' | 'traffic-flow';

export interface FloorPlanObject {
  id: string;
  object_type: FloorPlanObjectType;
  name: string;
  floor_plan_x: number;
  floor_plan_y: number;
  floor_plan_rotation?: number;
  company_id: string;
  created_at: string;
  
  // Common properties
  width?: number;
  height?: number;
  
  // Table-specific properties (when object_type === 'table')
  table_number?: number;
  seats?: number;
  shape?: string;
  type?: string;
  accessibility_friendly?: boolean;
  
  // Bar-specific properties (when object_type === 'bar')
  bar_length?: number;
  bar_width?: number;
  bar_style?: 'straight' | 'l-shaped' | 'curved';
  
  // Bar stool properties (when object_type === 'bar-stool')
  stool_height?: 'standard' | 'bar' | 'counter';
  
  // Booth properties (when object_type === 'booth')
  booth_seats?: number;
  booth_style?: 'corner' | 'straight' | 'circular';
  
  // High table properties (when object_type === 'high-table')
  high_table_seats?: number;
  
  // Waiting area properties (when object_type === 'waiting-bench')
  bench_capacity?: number;
  
  // Host stand properties (when object_type === 'host-stand')
  host_station_type?: 'podium' | 'desk' | 'counter';
  
  // Service station properties (when object_type === 'service-station')
  station_type?: 'pos' | 'coffee' | 'prep' | 'cleaning';
  
  // Storage properties (when object_type === 'storage')
  storage_type?: 'dry' | 'cold' | 'freezer' | 'cleaning' | 'equipment';
  
  // Wall properties (when object_type === 'wall')
  wall_length?: number;
  wall_thickness?: number;
  wall_type?: 'interior' | 'exterior' | 'partition';
  
  // Door properties (when object_type === 'door')
  door_type?: 'swing' | 'sliding' | 'double' | 'emergency';
  door_width?: number;
  
  // Window properties (when object_type === 'window')
  window_type?: 'fixed' | 'casement' | 'sliding' | 'bay';
  window_width?: number;
  
  // Column properties (when object_type === 'column')
  column_type?: 'round' | 'square' | 'decorative';
  column_diameter?: number;
  
  // Kitchen area properties (when object_type === 'kitchen-area')
  kitchen_type?: 'prep' | 'cooking' | 'dishwashing' | 'storage';
  
  // Traffic flow properties (when object_type === 'traffic-flow')
  flow_direction?: 'bidirectional' | 'one-way';
  flow_width?: number;
}

// Type guards for different object types
export const isTable = (obj: FloorPlanObject): obj is FloorPlanObject & { 
  table_number: number; 
  seats: number; 
} => obj.object_type === 'table';

export const isBar = (obj: FloorPlanObject): obj is FloorPlanObject & { 
  bar_length: number; 
  bar_width: number; 
} => obj.object_type === 'bar';

export const isBarStool = (obj: FloorPlanObject): obj is FloorPlanObject & { 
  stool_height: string; 
} => obj.object_type === 'bar-stool';

export const isBooth = (obj: FloorPlanObject): obj is FloorPlanObject & { 
  booth_seats: number; 
} => obj.object_type === 'booth';

// Additional type guards for new object types
export const isHighTable = (obj: FloorPlanObject): boolean => obj.object_type === 'high-table';
export const isWaitingBench = (obj: FloorPlanObject): boolean => obj.object_type === 'waiting-bench';
export const isHostStand = (obj: FloorPlanObject): boolean => obj.object_type === 'host-stand';
export const isServiceStation = (obj: FloorPlanObject): boolean => obj.object_type === 'service-station';
export const isStorage = (obj: FloorPlanObject): boolean => obj.object_type === 'storage';
export const isWall = (obj: FloorPlanObject): boolean => obj.object_type === 'wall';
export const isDoor = (obj: FloorPlanObject): boolean => obj.object_type === 'door';
export const isWindow = (obj: FloorPlanObject): boolean => obj.object_type === 'window';
export const isColumn = (obj: FloorPlanObject): boolean => obj.object_type === 'column';
export const isKitchenArea = (obj: FloorPlanObject): boolean => obj.object_type === 'kitchen-area';
export const isRestroom = (obj: FloorPlanObject): boolean => obj.object_type === 'restroom';
export const isOutdoorTable = (obj: FloorPlanObject): boolean => obj.object_type === 'outdoor-table';
export const isEmergencyExit = (obj: FloorPlanObject): boolean => obj.object_type === 'emergency-exit';
export const isAccessibilityPath = (obj: FloorPlanObject): boolean => obj.object_type === 'accessibility-path';
export const isTrafficFlow = (obj: FloorPlanObject): boolean => obj.object_type === 'traffic-flow';