import React, { useState } from 'react';
import VehicleMonitor from './VehicleMonitor';
import TireStockManager from './TireStockManager';
import WaterTestLogManager from './WaterTestLogManager';

const FactoryPanelLayout = () => {
    const [activeTab, setActiveTab] = useState('vehicles');

    const renderContent = () => {
        switch (activeTab) {
            case 'vehicles':
                return <VehicleMonitor />;
            case 'tires':
                return <TireStockManager />;
            case 'water':
                return <WaterTestLogManager />;
            default:
                return <VehicleMonitor />;
        }
    };

    const getTabClass = (tabName) => {
        return `px-4 py-2 font-medium text-sm rounded-md cursor-pointer transition-colors duration-200 ${
            activeTab === tabName
                ? 'bg-blue-600 text-white shadow'
                : 'text-gray-600 hover:bg-gray-200'
        }`;
    };

    return (
        <div className="flex flex-col h-screen bg-gray-100">
            <header className="bg-white shadow-sm p-4">
                <h1 className="text-2xl font-bold text-gray-800">Factory Operations</h1>
            </header>
            
            <div className="p-4">
                <div className="flex space-x-2 border-b border-gray-200 mb-4">
                    <button onClick={() => setActiveTab('vehicles')} className={getTabClass('vehicles')}>
                        Vehicle Fleet
                    </button>
                    <button onClick={() => setActiveTab('tires')} className={getTabClass('tires')}>
                        Tire Inventory
                    </button>
                    <button onClick={() => setActiveTab('water')} className={getTabClass('water')}>
                        Water Testing
                    </button>
                </div>
            </div>

            <main className="flex-grow p-4 overflow-auto">
                {renderContent()}
            </main>
        </div>
    );
};

export default FactoryPanelLayout;