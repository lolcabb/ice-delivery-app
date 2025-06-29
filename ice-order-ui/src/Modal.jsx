import React, { useEffect, useRef } from 'react';

const Modal = ({ isOpen, onClose, title, children }) => {
    // Ref to track if mousedown event occurred directly on the overlay
    const mouseDownOnOverlayRef = useRef(false);

    // Effect to handle Escape key press
    useEffect(() => {
        if (!isOpen) return; // Only run if modal is open

        const handleEscape = (event) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };
        document.addEventListener('keydown', handleEscape);
        return () => {
            document.removeEventListener('keydown', handleEscape);
        };
    }, [isOpen, onClose]); // Dependency array

    if (!isOpen) return null;

    // Handler for mousedown event on the overlay
    const handleOverlayMouseDown = (e) => {
        // Check if the mousedown event's target is the overlay div itself
        if (e.target === e.currentTarget) {
            mouseDownOnOverlayRef.current = true;
        } else {
            // If mousedown is on a child (e.g., modal content), set to false
            mouseDownOnOverlayRef.current = false;
        }
    };

    // Handler for mouseup event on the overlay
    const handleOverlayMouseUp = (e) => {
        // Check if mousedown was on the overlay AND mouseup is also on the overlay
        if (mouseDownOnOverlayRef.current && e.target === e.currentTarget) {
            onClose();
        }
        // Reset the ref after any mouseup on the overlay,
        // so it's fresh for the next interaction.
        mouseDownOnOverlayRef.current = false;
    };

    return (
        <div
            className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex justify-center items-center z-50 p-4 transition-opacity duration-300 ease-in-out"
            onMouseDown={handleOverlayMouseDown} // Use onMouseDown
            onMouseUp={handleOverlayMouseUp}   // Use onMouseUp
        >
            <div
                className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md transform transition-all duration-300 ease-in-out scale-95 opacity-0 animate-modalShow"
            >
                <div className="flex justify-between items-center mb-4 pb-3 border-b border-gray-200">
                    <h3 className="text-xl font-semibold text-gray-800">{title}</h3>
                    <button
                        onClick={onClose} // This close button is fine as is
                        className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-full hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        aria-label="ปิดหน้าต่าง"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                {children}
            </div>
            {/* Basic CSS for modal animation */}
            <style jsx global>{`
                @keyframes modalShow {
                    0% {
                        transform: scale(0.95);
                        opacity: 0;
                    }
                    100% {
                        transform: scale(1);
                        opacity: 1;
                    }
                }
                .animate-modalShow {
                    animation: modalShow 0.3s forwards;
                }
            `}</style>
        </div>
    );
};

export default Modal;