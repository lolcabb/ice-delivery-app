import { useState, useRef, useEffect, useCallback } from 'react';

// Define constants for easier configuration
const MAX_ZOOM = 3;
const MIN_ZOOM = 0.5;
const ZOOM_BUTTON_STEP = 0.25;
const SCROLL_ZOOM_SPEED = 0.1;

export const useZoomPan = (isOpen) => {
    const [zoomLevel, setZoomLevel] = useState(1);
    const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

    const containerRef = useRef(null);
    const imageRef = useRef(null);

    // Memoize the clamp function to ensure it's stable
    const clampImagePosition = useCallback((x, y) => {
        const container = containerRef.current;
        const image = imageRef.current;
        if (!container || !image) return { x, y };

        const containerRect = container.getBoundingClientRect();
        const imageRect = image.getBoundingClientRect();

        // Calculate the excess space. Note: imageRect.width already includes the current zoom.
        const maxX = Math.max(0, (imageRect.width - containerRect.width) / 2 / zoomLevel);
        const maxY = Math.max(0, (imageRect.height - containerRect.height) / 2 / zoomLevel);

        return {
            x: Math.max(-maxX, Math.min(maxX, x)),
            y: Math.max(-maxY, Math.min(maxY, y)),
        };
    }, [zoomLevel]); // Re-create only when zoomLevel changes

    // Zoom handlers
    const handleZoomIn = () => setZoomLevel(prev => Math.min(prev + ZOOM_BUTTON_STEP, MAX_ZOOM));
    const handleZoomOut = () => setZoomLevel(prev => Math.max(prev - ZOOM_BUTTON_STEP, MIN_ZOOM));
    
    const handleReset = () => {
        setZoomLevel(1);
        setImagePosition({ x: 0, y: 0 });
    };

    // Reset state when the modal is opened/closed
    useEffect(() => {
        if (isOpen) {
            handleReset();
        }
    }, [isOpen]);

    // Re-clamp position if zoom changes
    useEffect(() => {
        setImagePosition(pos => clampImagePosition(pos.x, pos.y));
    }, [zoomLevel, clampImagePosition]);

    // --- Event Handlers ---
    // These are defined inside the final effect to avoid stale state
    // and complex useCallback dependencies.
    useEffect(() => {
        if (!isOpen) return;

        const container = containerRef.current;

        const handleMouseDown = (e) => {
            if (e.button !== 0) return; // Only main left click
            if (zoomLevel > 1) {
                setIsDragging(true);
                setDragStart({
                    x: e.clientX - imagePosition.x,
                    y: e.clientY - imagePosition.y,
                });
            }
        };

        const handleMouseUp = () => setIsDragging(false);

        const handleMouseMove = (e) => {
            if (isDragging && zoomLevel > 1) {
                const newX = e.clientX - dragStart.x;
                const newY = e.clientY - dragStart.y;
                setImagePosition(clampImagePosition(newX, newY));
            }
        };

        const handleWheel = (e) => {
            // Only zoom if cursor is over the image container
            if (e.target.closest('.zoom-container')) {
                e.preventDefault();
                const zoomDirection = e.deltaY < 0 ? 1 : -1; // Up is zoom in, down is out
                setZoomLevel(prev => 
                    Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, prev + zoomDirection * SCROLL_ZOOM_SPEED))
                );
            }
        };

        // Attach listeners
        container?.addEventListener('mousedown', handleMouseDown);
        window.addEventListener('mouseup', handleMouseUp);
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('wheel', handleWheel, { passive: false });

        return () => {
            // Cleanup listeners
            container?.removeEventListener('mousedown', handleMouseDown);
            window.removeEventListener('mouseup', handleMouseUp);
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('wheel', handleWheel);
        };
    }, [isOpen, isDragging, dragStart, zoomLevel, clampImagePosition, imagePosition.x, imagePosition.y]);
    
    const imageStyle = {
        transform: `translate(${imagePosition.x}px, ${imagePosition.y}px) scale(${zoomLevel})`,
        cursor: isDragging ? 'grabbing' : zoomLevel > 1 ? 'grab' : 'auto',
        transition: isDragging ? 'none' : 'transform 0.1s ease-out',
    };

    return {
        containerRef,
        imageRef,
        zoomLevel,
        isDragging,
        imageStyle,
        handleZoomIn,
        handleZoomOut,
        handleReset, // Consider adding a reset button to the UI
    };
};