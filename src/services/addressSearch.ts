interface AddressResult {
  postcode: string;
  country: string;
  nhs_ha: string;
  longitude: number;
  latitude: number;
  european_electoral_region: string;
  primary_care_trust: string;
  region: string;
  lsoa: string;
  msoa: string;
  incode: string;
  outcode: string;
  parliamentary_constituency: string;
  admin_district: string;
  parish: string;
  admin_county: string;
  admin_ward: string;
  ced: string;
  ccg: string;
  nuts: string;
  codes: {
    admin_district: string;
    admin_county: string;
    admin_ward: string;
    parish: string;
    parliamentary_constituency: string;
    ccg: string;
    ccg_code: string;
    ced: string;
    nuts: string;
    lsoa: string;
    msoa: string;
    lau2: string;
  };
}

interface PostcodeApiResponse {
  status: number;
  result: AddressResult;
}

interface PostcodeSearchResponse {
  status: number;
  result: AddressResult[];
}

export interface SearchResult {
  postcode: string;
  display_name: string;
  latitude: number;
  longitude: number;
  city: string;
  county: string;
  country: string;
  district: string;
  ward: string;
}

export const searchAddress = async (query: string): Promise<SearchResult[]> => {
  // Clean the query
  const cleanQuery = query.trim().replace(/\s+/g, '');
  
  if (cleanQuery.length < 2) {
    return [];
  }

  try {
    // Try to search for postcode using postcodes.io
    const response = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(cleanQuery)}`);
    
    if (response.ok) {
      const data: PostcodeApiResponse = await response.json();
      const result = data.result;
      
      return [{
        postcode: result.postcode,
        display_name: `${result.postcode}, ${result.admin_district}, ${result.admin_county}`,
        latitude: result.latitude,
        longitude: result.longitude,
        city: result.admin_district,
        county: result.admin_county,
        country: result.country,
        district: result.admin_district,
        ward: result.admin_ward
      }];
    }

    // If exact match fails, try partial search
    const searchResponse = await fetch(`https://api.postcodes.io/postcodes?q=${encodeURIComponent(query)}&limit=5`);
    
    if (searchResponse.ok) {
      const searchData: PostcodeSearchResponse = await searchResponse.json();
      
      return searchData.result.map(result => ({
        postcode: result.postcode,
        display_name: `${result.postcode}, ${result.admin_district}, ${result.admin_county}`,
        latitude: result.latitude,
        longitude: result.longitude,
        city: result.admin_district,
        county: result.admin_county,
        country: result.country,
        district: result.admin_district,
        ward: result.admin_ward
      }));
    }

    return [];
  } catch (error) {
    console.error('Address search error:', error);
    return [];
  }
};