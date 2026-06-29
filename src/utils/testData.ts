// Test data for marketing preview - only used when not premium
export const TEST_MARKETING_DATA = {
  metrics: [
    {
      label: 'Total Reach',
      value: '12,450',
      change: '+15.2%',
      trend: 'up' as const,
      icon: 'TrendingUp' as const
    },
    {
      label: 'Engagement Rate', 
      value: '8.7%',
      change: '+2.1%',
      trend: 'up' as const,
      icon: 'Users' as const
    },
    {
      label: 'Active Campaigns',
      value: '3',
      change: 'No change',
      trend: 'neutral' as const,
      icon: 'MessageSquare' as const
    },
    {
      label: 'Click-through Rate',
      value: '4.3%', 
      change: '+0.8%',
      trend: 'up' as const,
      icon: 'Hash' as const
    }
  ],
  socialPosts: [
    {
      id: 'test-1',
      platform: 'Instagram',
      content: 'Check out our new seasonal menu! 🍂 Fresh ingredients and amazing flavors await you.',
      posted_at: '2024-01-15T10:30:00Z',
      likes: 245,
      comments: 18,
      shares: 12,
      media_url: null
    },
    {
      id: 'test-2', 
      platform: 'Facebook',
      content: 'Thank you to all our customers for making this year amazing! Here\'s to more delicious moments.',
      posted_at: '2024-01-14T15:45:00Z',
      likes: 189,
      comments: 25,
      shares: 8,
      media_url: null
    },
    {
      id: 'test-3',
      platform: 'Twitter',
      content: 'Happy hour specials all week! Join us for great food and even better company. 🍻',
      posted_at: '2024-01-13T18:20:00Z', 
      likes: 67,
      comments: 5,
      shares: 15,
      media_url: null
    }
  ],
  campaigns: [
    {
      id: 'test-campaign-1',
      name: 'Winter Menu Launch',
      status: 'active',
      reach: 5420,
      engagement: 312,
      created_at: '2024-01-10T00:00:00Z'
    },
    {
      id: 'test-campaign-2',
      name: 'Holiday Specials',
      status: 'completed', 
      reach: 8750,
      engagement: 678,
      created_at: '2024-01-05T00:00:00Z'
    }
  ]
};