"use client";

import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import debounce from "lodash/debounce";
import { SignaturePosition } from "@/app/types/signaturePosition";

interface DraggableSignatureProps {
  signature: SignaturePosition;
  signatureImage: string | null;
  activeSignatureId: string | null;
  setActiveSignatureId: (id: string) => void;
  pageDimensions: Map<
    number,
    {
      width: number;
      height: number;
      pdfWidth: number;
      pdfHeight: number;
      scale?: number;
    }
  >;
  updateSignatures: (updatedSignatures: SignaturePosition[]) => void;
  allSignatures: SignaturePosition[];
  removeSignature: (id: string) => void;
}

const DraggableSignature: React.FC<DraggableSignatureProps> = ({
  signature,
  signatureImage,
  activeSignatureId,
  setActiveSignatureId,
  pageDimensions,
  updateSignatures,
  allSignatures,
  removeSignature,
}) => {
  // Use refs to track position and size during drag/resize operations
  // without causing re-renders
  const positionRef = useRef({ x: signature.x, y: signature.y });
  const sizeRef = useRef({ width: signature.width, height: signature.height });

  // State for UI rendering - update these less frequently
  const [position, setPosition] = useState({ x: signature.x, y: signature.y });
  const [size, setSize] = useState({
    width: signature.width,
    height: signature.height,
  });

  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [resizeStartPos, setResizeStartPos] = useState({ x: 0, y: 0 });

  // Update the internal refs when signature props change
  useEffect(() => {
    positionRef.current = { x: signature.x, y: signature.y };
    sizeRef.current = { width: signature.width, height: signature.height };
    setPosition({ x: signature.x, y: signature.y });
    setSize({ width: signature.width, height: signature.height });
  }, [signature.x, signature.y, signature.width, signature.height]);

  // Helper function to convert between display and PDF coordinates
  const convertCoordinates = useCallback(
    (
      displayX: number,
      displayY: number,
      displayWidth: number,
      displayHeight: number
    ) => {
      // Get current page dimensions
      const dimensions = pageDimensions.get(signature.pageNumber);
      if (!dimensions)
        return {
          x: displayX,
          y: displayY,
          width: displayWidth,
          height: displayHeight,
        };

      // Get the current scale (default to 1 if not provided)
      const currentScale = dimensions.scale || 1;

      // Convert display coordinates back to normalized PDF coordinates
      const normalizedX = (displayX / dimensions.width) * dimensions.pdfWidth;
      const normalizedY = (displayY / dimensions.height) * dimensions.pdfHeight;
      const normalizedWidth =
        (displayWidth / dimensions.width) * dimensions.pdfWidth;
      const normalizedHeight =
        (displayHeight / dimensions.height) * dimensions.pdfHeight;

      return {
        // Keep the display coordinates for rendering
        x: displayX,
        y: displayY,
        width: displayWidth,
        height: displayHeight,
        // Store normalized values for backend/persistence
        normalizedX,
        normalizedY,
        normalizedWidth,
        normalizedHeight,
      };
    },
    [pageDimensions, signature.pageNumber]
  );

  // Memoized update function to reduce state updates
  const updateSignatureInParent = useCallback(
    debounce(() => {
      // Get current page dimensions
      const dimensions = pageDimensions.get(signature.pageNumber);
      if (!dimensions) return; // Don't update if dimensions aren't available

      // Convert current display coordinates to normalized PDF coordinates
      const {
        x,
        y,
        width,
        height,
        normalizedX,
        normalizedY,
        normalizedWidth,
        normalizedHeight,
      } = convertCoordinates(
        positionRef.current.x,
        positionRef.current.y,
        sizeRef.current.width,
        sizeRef.current.height
      );

      // Create a new array only if there's an actual change
      const updatedSignatures = allSignatures.map((sig) =>
        sig.id === signature.id
          ? {
              ...sig,
              x,
              y,
              width,
              height,
              // Store both display values and PDF normalized values
              pageWidth: dimensions.width,
              pageHeight: dimensions.height,
              pdfWidth: dimensions.pdfWidth,
              pdfHeight: dimensions.pdfHeight,
              // Store normalized coordinates for backend use
              normalizedX,
              normalizedY,
              normalizedWidth,
              normalizedHeight,
            }
          : sig
      );

      updateSignatures(updatedSignatures);
    }, 100),
    [
      signature.id,
      signature.pageNumber,
      pageDimensions,
      allSignatures,
      updateSignatures,
      convertCoordinates,
    ]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      setIsDragging(true);
      setStartPos({
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      });
      setActiveSignatureId(signature.id);

      // Stop event propagation to prevent parent handlers from firing
      e.stopPropagation();
      e.preventDefault(); // Add this to prevent any default browser actions
    },
    [position.x, position.y, setActiveSignatureId, signature.id]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return;

      // Update ref directly without state update during continuous movement
      positionRef.current = {
        x: e.clientX - startPos.x,
        y: e.clientY - startPos.y,
      };

      // Update visual position (less frequently)
      setPosition(positionRef.current);

      e.preventDefault();
    },
    [isDragging, startPos.x, startPos.y]
  );

  const handleMouseUp = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);

    // Final update to visual state
    setPosition(positionRef.current);

    // Make sure to call this to update the parent component with the final position
    updateSignatureInParent();
  }, [isDragging, updateSignatureInParent]);

  // Resize handlers
  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      setIsResizing(true);
      setResizeStartPos({ x: e.clientX, y: e.clientY });
      setActiveSignatureId(signature.id);

      // Stop event propagation to prevent parent handlers from firing
      e.stopPropagation();
      e.preventDefault(); // Add this to prevent any default browser actions
    },
    [setActiveSignatureId, signature.id]
  );

  const handleResizeMove = useCallback(
    (e: MouseEvent) => {
      if (!isResizing) return;

      const deltaX = e.clientX - resizeStartPos.x;
      const deltaY = e.clientY - resizeStartPos.y;

      // Update size ref directly
      sizeRef.current = {
        width: Math.max(50, size.width + deltaX),
        height: Math.max(30, size.height + deltaY),
      };

      // Update visual size (less frequently to avoid re-renders)
      setSize(sizeRef.current);

      // Reset resize start position to avoid cumulative changes
      setResizeStartPos({ x: e.clientX, y: e.clientY });

      e.preventDefault();
    },
    [isResizing, resizeStartPos.x, resizeStartPos.y, size.width, size.height]
  );

  const handleResizeEnd = useCallback(() => {
    if (!isResizing) return;
    setIsResizing(false);

    // Update size state with the final values
    setSize(sizeRef.current);

    // Make sure to call this to update the parent component
    updateSignatureInParent();
  }, [isResizing, updateSignatureInParent]);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }

    if (isResizing) {
      window.addEventListener("mousemove", handleResizeMove);
      window.addEventListener("mouseup", handleResizeEnd);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("mousemove", handleResizeMove);
      window.removeEventListener("mouseup", handleResizeEnd);
    };
  }, [
    isDragging,
    isResizing,
    handleMouseMove,
    handleMouseUp,
    handleResizeMove,
    handleResizeEnd,
  ]);

  // Update the useEffect that syncs signature props

  useEffect(() => {
    // Get current dimensions with updated scale
    const dimensions = pageDimensions.get(signature.pageNumber);
    if (!dimensions || !signature.normalizedX || !signature.normalizedY) return;
    
    // Recalculate position based on normalized coordinates and current scale
    const scaledX = (signature.normalizedX / dimensions.pdfWidth) * dimensions.width;
    const scaledY = (signature.normalizedY / dimensions.pdfHeight) * dimensions.height;
    const scaledWidth = signature.normalizedWidth ? 
        (signature.normalizedWidth / dimensions.pdfWidth) * dimensions.width : 
        size.width;
    const scaledHeight = signature.normalizedHeight ? 
        (signature.normalizedHeight / dimensions.pdfHeight) * dimensions.height : 
        size.height;
    
    // Update position and size
    positionRef.current = { x: scaledX, y: scaledY };
    sizeRef.current = { width: scaledWidth, height: scaledHeight };
    
    // Update visual state
    setPosition({ x: scaledX, y: scaledY });
    setSize({ width: scaledWidth, height: scaledHeight });
    
}, [pageDimensions, signature.pageNumber, signature.normalizedX, signature.normalizedY, 
    signature.normalizedWidth, signature.normalizedHeight]);

  // Use memo to avoid unnecessary re-renders
  return useMemo(
    () => (
      <div
        className={`absolute cursor-move group ${
          activeSignatureId === signature.id
            ? "z-20 ring-2 ring-blue-500"
            : "z-10"
        }`}
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          width: `${size.width}px`,
          height: `${size.height}px`,
        }}
        onMouseDown={handleMouseDown}
      >
        <img
          src={signature.signatureImageUrl || ""} // Only use the signature's own URL
          alt="Signature"
          className="w-full h-full object-contain pointer-events-none"
          style={{ maxWidth: "100%", maxHeight: "100%" }}
        />

        {/* Delete button */}
        <button
          className="absolute -top-3 -right-3 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-30"
          onMouseDown={(e) => {
            // Stop the event from triggering parent handlers
            e.stopPropagation();
            e.preventDefault();
          }}
          onClick={(e) => {
            // Prevent any event bubbling entirely
            e.stopPropagation();
            e.preventDefault();

            // Call the remove function directly
            removeSignature(signature.id);

            // Return false to ensure no more handlers are called
            return false;
          }}
        >
          ×
        </button>

        {/* Resize handle */}
        <div
          className="absolute bottom-0 right-0 w-4 h-4 bg-blue-500 opacity-0 group-hover:opacity-100 cursor-se-resize"
          onMouseDown={(e) => handleResizeStart(e)}
        />
      </div>
    ),
    [
      position,
      size,
      activeSignatureId,
      signature.id,
      signature.signatureImageUrl,
      handleMouseDown,
      handleResizeStart,
      removeSignature,
    ]
  );
};

export default DraggableSignature;
