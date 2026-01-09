/**
 * Right Sidebar - Properties panel
 * Shows when an object is selected
 */

import React from 'react';
import { PropertiesPanel } from './PropertiesPanel';
import './RightSidebar.css';

export const RightSidebar: React.FC = () => {
  return (
    <div className="right-sidebar">
      <PropertiesPanel />
    </div>
  );
};
