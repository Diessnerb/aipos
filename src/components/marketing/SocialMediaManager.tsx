
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Instagram, Facebook, Twitter, Plus, Calendar, Image, Video, Sparkles, TrendingUp, Users, Heart, MessageCircle, Repeat2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

export const SocialMediaManager = () => {
  const [selectedPlatform, setSelectedPlatform] = useState('');
  const [postContent, setPostContent] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');

  const platforms = [
    { id: 'instagram', name: 'Instagram', icon: Instagram, color: 'text-pink-600', connected: true },
    { id: 'facebook', name: 'Facebook', icon: Facebook, color: 'text-blue-600', connected: true },
    { id: 'twitter', name: 'Twitter', icon: Twitter, color: 'text-blue-400', connected: false }
  ];

  const recentPosts = [
    {
      id: 1,
      platform: 'instagram',
      content: 'Fresh ingredients, fresh flavors! 🍽️ Come taste our new spring menu items.',
      image: '/placeholder.svg',
      timestamp: '2 hours ago',
      likes: 124,
      comments: 8,
      shares: 3
    },
    {
      id: 2,
      platform: 'facebook',
      content: 'Weekend special: 20% off all pasta dishes! Book your table now.',
      timestamp: '5 hours ago',
      likes: 89,
      comments: 12,
      shares: 7
    },
    {
      id: 3,
      platform: 'instagram',
      content: 'Behind the scenes: Our chef preparing tonight\'s special! 👨‍🍳',
      image: '/placeholder.svg',
      timestamp: '1 day ago',
      likes: 201,
      comments: 15,
      shares: 12
    }
  ];

  const socialMetrics = [
    { platform: 'instagram', followers: '2.4K', engagement: '8.2%', posts: 45 },
    { platform: 'facebook', followers: '1.8K', engagement: '6.5%', posts: 38 },
    { platform: 'twitter', followers: '892', engagement: '4.1%', posts: 22 }
  ];

  const handleCreatePost = () => {
    if (!selectedPlatform || !postContent) {
      toast({
        title: "Missing Information",
        description: "Please select a platform and enter content.",
        variant: "destructive"
      });
      return;
    }

    toast({
      title: "Post Created",
      description: `Your post has been ${scheduledDate ? 'scheduled' : 'published'} successfully!`,
    });

    // Reset form
    setPostContent('');
    setScheduledDate('');
  };

  const generateAIContent = () => {
    const suggestions = [
      "🍽️ Discover our chef's special tonight - a perfect blend of fresh ingredients and traditional flavors that will tantalize your taste buds!",
      "✨ Weekend vibes call for exceptional dining! Join us for an unforgettable culinary experience with friends and family.",
      "🌟 New menu alert! We're excited to introduce our spring collection featuring locally sourced ingredients and innovative recipes.",
      "👨‍🍳 Behind the scenes: Watch our talented chefs craft each dish with passion and precision. Every meal is a work of art!"
    ];
    
    const randomSuggestion = suggestions[Math.floor(Math.random() * suggestions.length)];
    setPostContent(randomSuggestion);
    
    toast({
      title: "AI Content Generated",
      description: "Content suggestion has been added to your post!",
    });
  };

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'instagram': return Instagram;
      case 'facebook': return Facebook;
      case 'twitter': return Twitter;
      default: return Instagram;
    }
  };

  return (
    <div className="space-y-6">
      {/* Platform Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {platforms.map((platform) => (
          <Card key={platform.id}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <platform.icon className={`w-6 h-6 ${platform.color}`} />
                  <span className="font-medium">{platform.name}</span>
                </div>
                <Badge variant={platform.connected ? "default" : "secondary"}>
                  {platform.connected ? "Connected" : "Not Connected"}
                </Badge>
              </div>
              {platform.connected && (
                <div className="space-y-2 text-sm">
                  {socialMetrics.find(m => m.platform === platform.id) && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Followers:</span>
                        <span className="font-medium">
                          {socialMetrics.find(m => m.platform === platform.id)?.followers}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Engagement:</span>
                        <span className="font-medium">
                          {socialMetrics.find(m => m.platform === platform.id)?.engagement}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Posts:</span>
                        <span className="font-medium">
                          {socialMetrics.find(m => m.platform === platform.id)?.posts}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Create New Post */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Create New Post
            </CardTitle>
            <CardDescription>
              Compose and schedule your social media content
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Platform</Label>
              <Select value={selectedPlatform} onValueChange={setSelectedPlatform}>
                <SelectTrigger>
                  <SelectValue placeholder="Select platform" />
                </SelectTrigger>
                <SelectContent>
                  {platforms.filter(p => p.connected).map((platform) => (
                    <SelectItem key={platform.id} value={platform.id}>
                      <div className="flex items-center gap-2">
                        <platform.icon className={`w-4 h-4 ${platform.color}`} />
                        {platform.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label>Content</Label>
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm"
                  onClick={generateAIContent}
                  className="flex items-center gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  AI Generate
                </Button>
              </div>
              <Textarea
                placeholder="What's happening?"
                value={postContent}
                onChange={(e) => setPostContent(e.target.value)}
                rows={4}
              />
              <p className="text-xs text-gray-500">
                {postContent.length}/280 characters
              </p>
            </div>

            <div className="space-y-2">
              <Label>Schedule (Optional)</Label>
              <Input
                type="datetime-local"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
              />
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex items-center gap-2">
                <Image className="w-4 h-4" />
                Add Image
              </Button>
              <Button variant="outline" className="flex items-center gap-2">
                <Video className="w-4 h-4" />
                Add Video
              </Button>
            </div>

            <Button onClick={handleCreatePost} className="w-full">
              {scheduledDate ? 'Schedule Post' : 'Publish Now'}
            </Button>
          </CardContent>
        </Card>

        {/* Recent Posts */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Posts</CardTitle>
            <CardDescription>
              Your latest social media activity
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {recentPosts.map((post) => {
              const PlatformIcon = getPlatformIcon(post.platform);
              return (
                <div key={post.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <PlatformIcon className="w-4 h-4" />
                    <span className="text-sm font-medium capitalize">{post.platform}</span>
                    <span className="text-xs text-gray-500">{post.timestamp}</span>
                  </div>
                  
                  <p className="text-sm">{post.content}</p>
                  
                  {post.image && (
                    <div className="bg-gray-100 rounded-lg h-32 flex items-center justify-center">
                      <Image className="w-8 h-8 text-gray-400" />
                    </div>
                  )}
                  
                  <div className="flex items-center gap-4 text-xs text-gray-600">
                    <div className="flex items-center gap-1">
                      <Heart className="w-3 h-3" />
                      {post.likes}
                    </div>
                    <div className="flex items-center gap-1">
                      <MessageCircle className="w-3 h-3" />
                      {post.comments}
                    </div>
                    <div className="flex items-center gap-1">
                      <Repeat2 className="w-3 h-3" />
                      {post.shares}
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* Social Media Analytics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Social Media Performance
          </CardTitle>
          <CardDescription>
            Track your social media engagement across platforms
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">5.1K</div>
              <p className="text-sm text-gray-600">Total Followers</p>
              <p className="text-xs text-green-600">+12% this month</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">6.8%</div>
              <p className="text-sm text-gray-600">Avg. Engagement</p>
              <p className="text-xs text-green-600">+0.8% this month</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">105</div>
              <p className="text-sm text-gray-600">Posts This Month</p>
              <p className="text-xs text-green-600">+15% vs last month</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
