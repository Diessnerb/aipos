export interface DayOperatingHours {
  open: string; // HH:MM format (e.g., "09:00")
  close: string; // HH:MM format (e.g., "23:00" or "01:00" for past midnight)
  closed: boolean;
}

export interface FoodServicePeriod {
  name: string; // e.g., "Breakfast", "Lunch", "Dinner"
  start: string; // HH:MM format
  end: string; // HH:MM format
}

export interface WeekOperatingHours {
  monday: DayOperatingHours;
  tuesday: DayOperatingHours;
  wednesday: DayOperatingHours;
  thursday: DayOperatingHours;
  friday: DayOperatingHours;
  saturday: DayOperatingHours;
  sunday: DayOperatingHours;
}

export interface WeekFoodServiceHours {
  monday: FoodServicePeriod[];
  tuesday: FoodServicePeriod[];
  wednesday: FoodServicePeriod[];
  thursday: FoodServicePeriod[];
  friday: FoodServicePeriod[];
  saturday: FoodServicePeriod[];
  sunday: FoodServicePeriod[];
}

export interface OpeningHoursData {
  operating: WeekOperatingHours;
  foodService: WeekFoodServiceHours;
}

export const DAYS_OF_WEEK = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
export type DayOfWeek = typeof DAYS_OF_WEEK[number];

export const DEFAULT_OPERATING_HOURS: WeekOperatingHours = {
  monday: { open: '09:00', close: '23:00', closed: false },
  tuesday: { open: '09:00', close: '23:00', closed: false },
  wednesday: { open: '09:00', close: '23:00', closed: false },
  thursday: { open: '09:00', close: '23:00', closed: false },
  friday: { open: '09:00', close: '01:00', closed: false },
  saturday: { open: '09:00', close: '01:00', closed: false },
  sunday: { open: '09:00', close: '22:00', closed: false },
};

export const DEFAULT_FOOD_SERVICE_HOURS: WeekFoodServiceHours = {
  monday: [],
  tuesday: [],
  wednesday: [],
  thursday: [],
  friday: [],
  saturday: [],
  sunday: [],
};
