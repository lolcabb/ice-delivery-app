import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiService } from '../apiService';
import { formatDisplayDate } from '../utils/dateUtils';
import { ArrowLeftIcon, UserGroupIcon, CalendarDaysIcon, MapPinIcon, ArrowPathIcon } from '../components/Icons';
import SalesEntryGrid from './SalesEntryGrid'; // We will use the non-modal version of the grid

export default function SalesGridPage() {
    const { summaryId } = useParams(); // Get summary_id from URL
    const navigate = useNavigate();

    const [summary, setSummary] = useState(null);
    const [products, setProducts] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchData = useCallback(async () => {
        if (!summaryId) return;
        setIsLoading(true);
        setError(null);
        try {
            const [summaryResponse, productsResponse] = await Promise.all([
                apiService.getDriverDailySummaries({ summary_id: summaryId }),
                apiService.getSalesProducts()
            ]);
            
            // If the response was not modified, we don't need to update the state.
            // This prevents setting the summary to null and causing a re-render loop.
            if (!summaryResponse.notModified) {
                const summaryResult = Array.isArray(summaryResponse.data) ? summaryResponse.data[0] : null;
                if (!summaryResult) {
                    throw new Error("Sales summary for this day could not be found.");
                }
                setSummary(summaryResult);
            }
            
            if (!productsResponse.notModified) {
                setProducts(Array.isArray(productsResponse.data) ? productsResponse.data : []);
            }
        } catch (err) {
            setError("Could not load data for this sales entry page. " + (err.data?.error || err.message));
        } finally {
            setIsLoading(false);
        }
    }, [summaryId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-screen text-gray-500">
                <ArrowPathIcon className="w-8 h-8 animate-spin mr-3"/>
                <span className="text-lg">Loading Sales Entry...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-8">
                <div className="p-4 bg-red-100 text-red-800 border border-red-200 rounded-md">
                    <h2 className="font-bold mb-2">Error</h2>
                    <p>{error}</p>
                    <button onClick={() => navigate(-1)} className="mt-4 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700">Go Back</button>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 sm:p-6 lg:p-8 bg-gray-50 min-h-screen">
            <div className="max-w-screen-2xl mx-auto">
                {/* Page Header */}
                <div className="mb-4">
                    <button onClick={() => navigate(-1)} className="flex items-center text-sm font-medium text-gray-600 hover:text-gray-900 mb-2">
                        <ArrowLeftIcon className="w-5 h-5 mr-1" />
                        Back to Daily Operations
                    </button>
                    <h1 className="text-2xl font-bold text-gray-800">Batch Sales Entry</h1>
                    {summary && (
                         <div className="flex flex-wrap items-center text-sm text-gray-500 mt-1 gap-x-4 gap-y-1">
                             <div className="flex items-center">
                                <UserGroupIcon className="w-4 h-4 mr-1.5"/>
                                <strong>Driver:</strong><span className="ml-1">{summary.driver_name}</span>
                             </div>
                             <div className="flex items-center">
                                <CalendarDaysIcon className="w-4 h-4 mr-1.5"/>
                                <strong>Date:</strong><span className="ml-1">{formatDisplayDate(summary.sale_date)}</span>
                             </div>
                              {summary.route_name && (
                             <div className="flex items-center">
                                <MapPinIcon className="w-4 h-4 mr-1.5"/>
                                <strong>Route:</strong><span className="ml-1">{summary.route_name}</span>
                             </div>
                             )}
                         </div>
                    )}
                </div>

                {/* The Grid Component */}
                <div className="bg-white shadow-lg rounded-lg p-4">
                     <SalesEntryGrid 
                        summary={summary}
                        products={products}
                        onSaveSuccess={() => {
                            // On successful save, navigate back to the previous page
                            navigate(-1); 
                        }}
                    />
                </div>
            </div>
        </div>
    );
}