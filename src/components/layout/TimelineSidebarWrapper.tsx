import React from 'react';
import { useSidebar } from '@/components/ui/sidebar';
import TimelineSidebar from './TimelineSidebar';

interface TimelineSidebarWrapperProps {
  searchOpen: boolean;
  setSearchOpen: (open: boolean) => void;
}

const TimelineSidebarWrapper = ({ searchOpen, setSearchOpen }: TimelineSidebarWrapperProps) => {
  return <TimelineSidebar searchOpen={searchOpen} setSearchOpen={setSearchOpen} />;
};

export default TimelineSidebarWrapper;