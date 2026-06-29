
import React from 'react';
import { BottomTabBar } from '@/components/navigation/BottomTabBar';

interface TabLayoutProps {
  children: React.ReactNode;
}

const TabLayout = ({ children }: TabLayoutProps) => {
  return (
    <div className="h-screen bg-white overflow-hidden flex flex-col">
      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto pb-20">
        {children}
      </main>
      
      {/* Bottom Tab Navigation */}
      <BottomTabBar />
    </div>
  );
};

export default TabLayout;
