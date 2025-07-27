import React, { useState, useEffect } from 'react';
import { useZoomPan } from '../hooks/useZoomPan';

export default function ReceiptModal({ isOpen, onClose, imageUrl, expenseDescription }) {
    const [imageState, setImageState] = useState({ loading: true, error: false });

    const {
        containerRef,
        imageRef,
        imageStyle,
        containerStyle,
        handleZoomIn,
        handleZoomOut,
        handleReset,
        handleImageLoad: hookImageLoad,
        zoomLevel
    } = useZoomPan(isOpen);

    useEffect(() => {
        setImageState({ loading: true, error: false });
    }, [imageUrl, isOpen]);

    const handleImageLoad = (e) => {
        setImageState({ loading: false, error: false });
        hookImageLoad(e);
    };

    const handleImageError = () => setImageState({ loading: false, error: true });

    const handleOverlayClick = (e) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') onClose();
        };
        if (isOpen) {
            window.addEventListener('keydown', handleKeyDown);
            return () => window.removeEventListener('keydown', handleKeyDown);
        }
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-50 overflow-hidden"
            onClick={handleOverlayClick}
            aria-labelledby="modal-title"
            role="dialog"
            aria-modal="true"
        >
            <div className="flex items-center justify-center min-h-screen p-4">
                <div className="fixed inset-0 bg-gray-900 bg-opacity-75 transition-opacity" aria-hidden="true"></div>
                <div className="relative bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[85vh] flex flex-col">
                    <div className="bg-white px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                        <div className="flex-1">
                            <h3 id="modal-title" className="text-lg leading-6 font-medium text-gray-900">
                                ใบเสร็จ/หลักฐาน
                            </h3>
                            {expenseDescription && (
                                <p className="mt-1 text-sm text-gray-600">{expenseDescription}</p>
                            )}
                        </div>
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-gray-500 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-md p-1"
                        >
                            <span className="sr-only">Close</span>
                            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                    <div className="flex-1 relative bg-gray-50">
                        <div
                            ref={containerRef}
                            className="zoom-container w-full h-full flex items-center justify-center"
                            style={{
                                minHeight: '60vh',
                                ...containerStyle
                            }}
                        >
                            {imageState.loading && (
                                <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
                                    <div className="text-gray-500">กำลังโหลดรูปภาพ...</div>
                                </div>
                            )}

                            {imageState.error ? (
                                <div className="text-center text-red-500 p-4">
                                    <p>ไม่สามารถโหลดรูปภาพได้</p>
                                    <p className="text-xs text-gray-400 mt-1 truncate max-w-md mx-auto">URL: {imageUrl}</p>
                                </div>
                            ) : (
                                <img
                                    ref={imageRef}
                                    src={imageUrl}
                                    alt="ใบเสร็จ"
                                    className={`max-w-full max-h-full object-contain ${imageState.loading ? 'opacity-0' : 'opacity-100'}`}
                                    onLoad={handleImageLoad}
                                    onError={handleImageError}
                                    style={imageStyle}
                                    draggable={false}
                                />
                            )}

                            {!imageState.error && !imageState.loading && (
                                <div className="absolute top-4 right-4 flex flex-col space-y-2">
                                    <div className="bg-white rounded-lg shadow-lg p-1">
                                        <button
                                            onClick={handleZoomIn}
                                            className="block w-10 h-10 text-gray-700 hover:bg-gray-100 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            title="Zoom In"
                                        >
                                            <svg className="w-5 h-5 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
                                            </svg>
                                        </button>
                                        <button
                                            onClick={handleZoomOut}
                                            className="block w-10 h-10 text-gray-700 hover:bg-gray-100 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            title="Zoom Out"
                                        >
                                            <svg className="w-5 h-5 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM15 10H9" />
                                            </svg>
                                        </button>
                                        <button
                                            onClick={handleReset}
                                            className="block w-10 h-10 text-gray-700 hover:bg-gray-100 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            title="Reset"
                                        >
                                            <svg className="w-5 h-5 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                            </svg>
                                        </button>
                                    </div>
                                    <div className="bg-white rounded-lg shadow-lg px-3 py-1 text-center">
                                        <span className="text-xs text-gray-600">{Math.round(zoomLevel * 100)}%</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="bg-gray-50 px-6 py-3 border-t border-gray-200 flex justify-between items-center">
                        <div className="text-xs text-gray-500">
                            ใช้ล้อเมาส์เพื่อซูม, ดับเบิลคลิกเพื่อซูมเข้า/ออก, ลากเพื่อเลื่อนดูภาพ
                        </div>
                        {!imageState.error && (
                            <a
                                href={imageUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:text-sm transition-colors"
                            >
                                เปิดในแท็บใหม่
                            </a>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
