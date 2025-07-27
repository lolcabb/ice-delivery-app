import { useState, useRef, useEffect, useCallback } from 'react';

// Define constants for easier configuration
const MAX_ZOOM = 5;
const MIN_ZOOM = 0.5;
const ZOOM_BUTTON_STEP = 0.25;
const SCROLL_ZOOM_SPEED = 0.002;
const DOUBLE_CLICK_ZOOM = 2;
const MIN_VISIBLE_AREA = 50; // Minimum pixels of image that must remain visible for dragging back

export const useZoomPan = (isOpen) => {
    const [zoomLevel, setZoomLevel] = useState(1);
    const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const isDraggingRef = useRef(false);
    const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
    const [containerDimensions, setContainerDimensions] = useState({ width: 0, height: 0 });

    const containerRef = useRef(null);
    const imageRef = useRef(null);
    const dragStartRef = useRef({ x: 0, y: 0 });
    const imagePositionRef = useRef({ x: 0, y: 0 });

    const setDragging = useCallback((val) => {
        isDraggingRef.current = val;
        setIsDragging(val);
    }, []);

    // Calculate boundaries for panning - ensure minimum visible area remains
    const calculateBounds = useCallback(() => {
        if (!imageDimensions.width || !containerDimensions.width) {
            return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
        }

        const scaledWidth = imageDimensions.width * zoomLevel;
        const scaledHeight = imageDimensions.height * zoomLevel;

        // Calculate bounds to ensure MIN_VISIBLE_AREA pixels remain visible
        // This prevents the image from being dragged completely out of view
        const minX = containerDimensions.width - scaledWidth + MIN_VISIBLE_AREA;
        const maxX = -MIN_VISIBLE_AREA;
        const minY = containerDimensions.height - scaledHeight + MIN_VISIBLE_AREA;
        const maxY = -MIN_VISIBLE_AREA;

        return { minX, maxX, minY, maxY };
    }, [imageDimensions, containerDimensions, zoomLevel]);

    // Clamp position within bounds
    const clampPosition = useCallback((x, y) => {
        const bounds = calculateBounds();
        
        // Clamp X - ensure minimum visible area remains
        let clampedX = x;
        if (bounds.minX < bounds.maxX) {
            clampedX = Math.max(bounds.minX, Math.min(bounds.maxX, x));
        }
        
        // Clamp Y - ensure minimum visible area remains
        let clampedY = y;
        if (bounds.minY < bounds.maxY) {
            clampedY = Math.max(bounds.minY, Math.min(bounds.maxY, y));
        }
        
        return {
            x: clampedX,
            y: clampedY
        };
    }, [calculateBounds]);

    // Update dimensions when image loads or container resizes
    const updateDimensions = useCallback((shouldFitToContainer = false) => {
        if (imageRef.current && containerRef.current) {
            const img = imageRef.current;
            const container = containerRef.current;

            const imgWidth = img.naturalWidth || img.offsetWidth;
            const imgHeight = img.naturalHeight || img.offsetHeight;
            const containerWidth = container.offsetWidth;
            const containerHeight = container.offsetHeight;

            setImageDimensions({
                width: imgWidth,
                height: imgHeight
            });

            setContainerDimensions({
                width: containerWidth,
                height: containerHeight
            });

            // Calculate initial zoom to fit image in container
            if (shouldFitToContainer && imgWidth > 0 && imgHeight > 0) {
                // Calculate scale needed to fit width and height
                const scaleX = containerWidth / imgWidth;
                const scaleY = containerHeight / imgHeight;
                
                // Use the smaller scale to ensure the entire image fits
                // Apply a small padding factor (0.9) to ensure some margin
                const fitScale = Math.min(scaleX, scaleY) * 0.9;
                
                // Clamp between min and max zoom, but also don't zoom in beyond 1.0
                const initialZoom = Math.min(Math.max(MIN_ZOOM, fitScale), 1.0);
                
                setZoomLevel(initialZoom);
                setImagePosition({ x: 0, y: 0 });
                imagePositionRef.current = { x: 0, y: 0 };
            }
        }
    }, []);

    // Zoom to a specific point (for mouse wheel zoom)
    const zoomToPoint = useCallback((newZoom, pointX, pointY) => {
        const container = containerRef.current;
        if (!container) return;

        const rect = container.getBoundingClientRect();
        const x = pointX - rect.left - rect.width / 2;
        const y = pointY - rect.top - rect.height / 2;

        const zoomRatio = newZoom / zoomLevel;

        // Adjust position to keep the zoom point stationary
        const newX = x - (x - imagePosition.x) * zoomRatio;
        const newY = y - (y - imagePosition.y) * zoomRatio;

        setZoomLevel(newZoom);
        
        // Clamp the new position with the new zoom level
        const clamped = clampPosition(newX, newY);
        setImagePosition(clamped);
        imagePositionRef.current = clamped;
    }, [zoomLevel, imagePosition, clampPosition]);

    // Button zoom handlers (zoom to center)
    const handleZoomIn = useCallback(() => {
        const newZoom = Math.min(zoomLevel + ZOOM_BUTTON_STEP, MAX_ZOOM);
        setZoomLevel(newZoom);
    }, [zoomLevel]);

    const handleZoomOut = useCallback(() => {
        const newZoom = Math.max(zoomLevel - ZOOM_BUTTON_STEP, MIN_ZOOM);
        setZoomLevel(newZoom);
    }, [zoomLevel]);

    const handleReset = useCallback(() => {
        setZoomLevel(1);
        setImagePosition({ x: 0, y: 0 });
        imagePositionRef.current = { x: 0, y: 0 };
    }, []);

    // Reset state when modal opens
    useEffect(() => {
        if (isOpen) {
            handleReset();
            // Don't update dimensions here - wait for image load
        }
    }, [isOpen, handleReset]);

    // Update dimensions on window resize
    useEffect(() => {
        const handleResize = () => updateDimensions(false);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [updateDimensions]);

    // Re-clamp position when zoom changes
    useEffect(() => {
        setImagePosition(prevPos => {
            const clamped = clampPosition(prevPos.x, prevPos.y);
            imagePositionRef.current = clamped;
            return clamped;
        });
    }, [zoomLevel, clampPosition]);

    // Mouse and touch event handlers
    useEffect(() => {
        if (!isOpen || !containerRef.current) return;

        const container = containerRef.current;

        // Mouse down handler
        const handleMouseDown = (e) => {
            if (e.button !== 0) return; // Only left click
            
            e.preventDefault();
            e.stopPropagation();
            
            setDragging(true);
            dragStartRef.current = {
                x: e.clientX - imagePositionRef.current.x,
                y: e.clientY - imagePositionRef.current.y
            };
            
            // Add cursor style
            document.body.style.cursor = 'grabbing';
            container.style.cursor = 'grabbing';
        };

        // Mouse move handler (global)
        const handleMouseMove = (e) => {
            if (!isDraggingRef.current) return;
            
            e.preventDefault();
            
            const newX = e.clientX - dragStartRef.current.x;
            const newY = e.clientY - dragStartRef.current.y;
            const clamped = clampPosition(newX, newY);
            
            setImagePosition(clamped);
            imagePositionRef.current = clamped;
        };

        // Mouse up handler (global)
        const handleMouseUp = () => {
            if (!isDraggingRef.current) return;

            setDragging(false);
            
            // Reset cursor
            document.body.style.cursor = '';
            if (container) container.style.cursor = 'grab';
        };

        // Mouse wheel zoom
        const handleWheel = (e) => {
            e.preventDefault();
            const delta = -e.deltaY * SCROLL_ZOOM_SPEED;
            const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoomLevel + delta));
            
            // Update zoom level first to ensure correct bounds calculation
            const prevZoom = zoomLevel;
            setZoomLevel(newZoom);
            
            // Then calculate the new position
            const rect = container.getBoundingClientRect();
            const x = e.clientX - rect.left - rect.width / 2;
            const y = e.clientY - rect.top - rect.height / 2;
            
            const zoomRatio = newZoom / prevZoom;
            
            // Adjust position to keep the zoom point stationary
            const newPosX = x - (x - imagePositionRef.current.x) * zoomRatio;
            const newPosY = y - (y - imagePositionRef.current.y) * zoomRatio;
            
            // Need to manually calculate bounds with new zoom for immediate update
            const scaledWidth = imageDimensions.width * newZoom;
            const scaledHeight = imageDimensions.height * newZoom;
            
            const bounds = {
                minX: containerDimensions.width - scaledWidth + MIN_VISIBLE_AREA,
                maxX: -MIN_VISIBLE_AREA,
                minY: containerDimensions.height - scaledHeight + MIN_VISIBLE_AREA,
                maxY: -MIN_VISIBLE_AREA
            };
            
            let clampedX = newPosX;
            if (bounds.minX < bounds.maxX) {
                clampedX = Math.max(bounds.minX, Math.min(bounds.maxX, newPosX));
            }
            
            let clampedY = newPosY;
            if (bounds.minY < bounds.maxY) {
                clampedY = Math.max(bounds.minY, Math.min(bounds.maxY, newPosY));
            }
            
            const clamped = { x: clampedX, y: clampedY };
            setImagePosition(clamped);
            imagePositionRef.current = clamped;
        };

        // Double click to zoom
        const handleDoubleClick = (e) => {
            e.preventDefault();
            const newZoom = zoomLevel === 1 ? DOUBLE_CLICK_ZOOM : 1;
            if (newZoom === 1) {
                handleReset();
            } else {
                zoomToPoint(newZoom, e.clientX, e.clientY);
            }
        };

        // Touch handlers
        let lastTouchDistance = 0;

        const handleTouchStart = (e) => {
            if (e.touches.length === 1) {
                const touch = e.touches[0];
                setDragging(true);
                dragStartRef.current = {
                    x: touch.clientX - imagePositionRef.current.x,
                    y: touch.clientY - imagePositionRef.current.y
                };
            } else if (e.touches.length === 2) {
                const distance = Math.hypot(
                    e.touches[0].clientX - e.touches[1].clientX,
                    e.touches[0].clientY - e.touches[1].clientY
                );
                lastTouchDistance = distance;
            }
        };

        const handleTouchMove = (e) => {
            e.preventDefault();
            
            if (e.touches.length === 1 && isDraggingRef.current) {
                const touch = e.touches[0];
                const newX = touch.clientX - dragStartRef.current.x;
                const newY = touch.clientY - dragStartRef.current.y;
                const clamped = clampPosition(newX, newY);
                
                setImagePosition(clamped);
                imagePositionRef.current = clamped;
            } else if (e.touches.length === 2 && lastTouchDistance > 0) {
                const distance = Math.hypot(
                    e.touches[0].clientX - e.touches[1].clientX,
                    e.touches[0].clientY - e.touches[1].clientY
                );
                
                const scale = distance / lastTouchDistance;
                const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoomLevel * scale));
                
                const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
                const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
                zoomToPoint(newZoom, midX, midY);
                
                lastTouchDistance = distance;
            }
        };

        const handleTouchEnd = () => {
            setDragging(false);
            lastTouchDistance = 0;
        };

        // Add event listeners
        container.addEventListener('mousedown', handleMouseDown);
        container.addEventListener('wheel', handleWheel, { passive: false });
        container.addEventListener('dblclick', handleDoubleClick);
        container.addEventListener('touchstart', handleTouchStart, { passive: false });
        container.addEventListener('touchmove', handleTouchMove, { passive: false });
        container.addEventListener('touchend', handleTouchEnd);
        
        // Global listeners - these need to be on document/window to catch mouse movement outside container
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        // Set initial cursor
        container.style.cursor = 'grab';

        return () => {
            container.removeEventListener('mousedown', handleMouseDown);
            container.removeEventListener('wheel', handleWheel);
            container.removeEventListener('dblclick', handleDoubleClick);
            container.removeEventListener('touchstart', handleTouchStart);
            container.removeEventListener('touchmove', handleTouchMove);
            container.removeEventListener('touchend', handleTouchEnd);
            
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            
            // Reset cursor
            document.body.style.cursor = '';
        };
    }, [isOpen, zoomLevel, imageDimensions, containerDimensions, clampPosition, handleReset]);

    // Update cursor when dragging state changes
    useEffect(() => {
        if (!containerRef.current) return;
        containerRef.current.style.cursor = isDragging ? 'grabbing' : 'grab';
    }, [isDragging]);

    // Image load handler
    const handleImageLoad = useCallback(() => {
        // Update dimensions and fit to container on first load
        updateDimensions(true);
    }, [updateDimensions]);

    const imageStyle = {
        transform: `translate(${imagePosition.x}px, ${imagePosition.y}px) scale(${zoomLevel})`,
        cursor: 'inherit', // Inherit from container
        transition: isDragging ? 'none' : 'transform 0.1s ease-out',
        transformOrigin: 'center',
        userSelect: 'none',
        touchAction: 'none',
        willChange: isDragging ? 'transform' : 'auto',
        pointerEvents: 'none', // Important: prevent image from capturing mouse events
        position: 'relative', // Ensure proper positioning
        zIndex: 1 // Ensure image is above container background
    };

    const containerStyle = {
        overflow: 'visible', // Allow image to render outside container bounds
        position: 'relative', // Ensure proper positioning context
        clipPath: 'inset(0)', // Create a clipping context that respects the container bounds
    };

    return {
        containerRef,
        imageRef,
        zoomLevel,
        isDragging,
        imageStyle,
        containerStyle,
        handleZoomIn,
        handleZoomOut,
        handleReset,
        handleImageLoad
    };
};