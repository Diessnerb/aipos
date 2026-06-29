import React from 'react';
import { Outlet } from 'react-router-dom';
import Layout from './Layout';

const MainLayout = () => {
  return (
    <Layout>
      <Outlet />
    </Layout>
  );
};

export default MainLayout;