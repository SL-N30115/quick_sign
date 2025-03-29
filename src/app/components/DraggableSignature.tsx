import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import debounce from "lodash/debounce";
import { SignaturePosition } from "@/app/types/signaturePosition";

// Add these constants for resize handles
const RESIZE_HANDLES = ["nw", "n", "ne", "w", "e", "sw", "s", "se"] as const;

type ResizeHandle = (typeof RESIZE_HANDLES)[number];

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
  const aspectRatioRef = useRef(signature.width / signature.height);

  // State for UI rendering - update these less frequently
  const [position, setPosition] = useState({ x: signature.x, y: signature.y });
  const [size, setSize] = useState({
    width: signature.width,
    height: signature.height,
  });

  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [activeHandle, setActiveHandle] = useState<ResizeHandle | null>(null);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [startSize, setStartSize] = useState({ width: 0, height: 0 });
  const [startPosition, setStartPosition] = useState({ x: 0, y: 0 });

  // Update the internal refs when signature props change
  useEffect(() => {
    positionRef.current = { x: signature.x, y: signature.y };
    sizeRef.current = { width: signature.width, height: signature.height };
    aspectRatioRef.current = signature.width / signature.height;
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

  // Resize handlers - improved version
  const handleResizeStart = useCallback(
    (e: React.MouseEvent, handle: ResizeHandle) => {
      setIsResizing(true);
      setActiveHandle(handle);
      setStartPos({ x: e.clientX, y: e.clientY });
      setStartSize({ width: size.width, height: size.height });
      setStartPosition({ x: position.x, y: position.y });
      setActiveSignatureId(signature.id);

      // Stop event propagation to prevent parent handlers from firing
      e.stopPropagation();
      e.preventDefault();
    },
    [
      size.width,
      size.height,
      position.x,
      position.y,
      setActiveSignatureId,
      signature.id,
    ]
  );

  const handleResizeMove = useCallback(
    (e: MouseEvent) => {
      if (!isResizing || !activeHandle) return;

      const deltaX = e.clientX - startPos.x;
      const deltaY = e.clientY - startPos.y;

      // Store original values
      const originalWidth = startSize.width;
      const originalHeight = startSize.height;
      const originalX = startPosition.x;
      const originalY = startPosition.y;

      // Calculate new dimensions while preserving aspect ratio
      let newWidth = originalWidth;
      let newHeight = originalHeight;
      let newX = originalX;
      let newY = originalY;

      // Determine the resize behavior based on which handle was grabbed
      switch (activeHandle) {
        case "se": // Bottom-right
          newWidth = Math.max(50, originalWidth + deltaX);
          newHeight = newWidth / aspectRatioRef.current;
          break;

        case "sw": // Bottom-left
          newWidth = Math.max(50, originalWidth - deltaX);
          newHeight = newWidth / aspectRatioRef.current;
          newX = originalX + (originalWidth - newWidth);
          break;

        case "ne": // Top-right
          newWidth = Math.max(50, originalWidth + deltaX);
          newHeight = newWidth / aspectRatioRef.current;
          newY = originalY + (originalHeight - newHeight);
          break;

        case "nw": // Top-left
          newWidth = Math.max(50, originalWidth - deltaX);
          newHeight = newWidth / aspectRatioRef.current;
          newX = originalX + (originalWidth - newWidth);
          newY = originalY + (originalHeight - newHeight);
          break;

        case "n": // Top center
          newHeight = Math.max(30, originalHeight - deltaY);
          newWidth = newHeight * aspectRatioRef.current;
          newY = originalY + (originalHeight - newHeight);
          newX = originalX + (originalWidth - newWidth) / 2;
          break;

        case "s": // Bottom center
          newHeight = Math.max(30, originalHeight + deltaY);
          newWidth = newHeight * aspectRatioRef.current;
          newX = originalX + (originalWidth - newWidth) / 2;
          break;

        case "w": // Left center
          newWidth = Math.max(50, originalWidth - deltaX);
          newHeight = newWidth / aspectRatioRef.current;
          newX = originalX + (originalWidth - newWidth);
          newY = originalY + (originalHeight - newHeight) / 2;
          break;

        case "e": // Right center
          newWidth = Math.max(50, originalWidth + deltaX);
          newHeight = newWidth / aspectRatioRef.current;
          newY = originalY + (originalHeight - newHeight) / 2;
          break;
      }

      // Update the refs (for performance)
      positionRef.current = { x: newX, y: newY };
      sizeRef.current = { width: newWidth, height: newHeight };

      // Update state for rendering
      setPosition({ x: newX, y: newY });
      setSize({ width: newWidth, height: newHeight });

      e.preventDefault();
    },
    [
      isResizing,
      activeHandle,
      startPos.x,
      startPos.y,
      startSize.width,
      startSize.height,
      startPosition.x,
      startPosition.y,
    ]
  );

  const handleResizeEnd = useCallback(() => {
    if (!isResizing) return;
    setIsResizing(false);
    setActiveHandle(null);

    // Update size state with the final values
    setSize(sizeRef.current);
    setPosition(positionRef.current);

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

  useEffect(() => {
    // Get current dimensions with updated scale
    const dimensions = pageDimensions.get(signature.pageNumber);
    if (!dimensions || !signature.normalizedX || !signature.normalizedY) return;

    // Recalculate position based on normalized coordinates and current scale
    const scaledX =
      (signature.normalizedX / dimensions.pdfWidth) * dimensions.width;
    const scaledY =
      (signature.normalizedY / dimensions.pdfHeight) * dimensions.height;
    const scaledWidth = signature.normalizedWidth
      ? (signature.normalizedWidth / dimensions.pdfWidth) * dimensions.width
      : size.width;
    const scaledHeight = signature.normalizedHeight
      ? (signature.normalizedHeight / dimensions.pdfHeight) * dimensions.height
      : size.height;

    // Update position and size
    positionRef.current = { x: scaledX, y: scaledY };
    sizeRef.current = { width: scaledWidth, height: scaledHeight };

    // Update aspect ratio
    aspectRatioRef.current = scaledWidth / scaledHeight;

    // Update visual state
    setPosition({ x: scaledX, y: scaledY });
    setSize({ width: scaledWidth, height: scaledHeight });
  }, [
    pageDimensions,
    signature.pageNumber,
    signature.normalizedX,
    signature.normalizedY,
    signature.normalizedWidth,
    signature.normalizedHeight,
  ]);

  // Helper function to get cursor style based on handle
  const getHandleCursor = (handle: ResizeHandle): string => {
    switch (handle) {
      case "nw":
        return "nwse-resize";
      case "n":
        return "ns-resize";
      case "ne":
        return "nesw-resize";
      case "e":
        return "ew-resize";
      case "se":
        return "nwse-resize";
      case "s":
        return "ns-resize";
      case "sw":
        return "nesw-resize";
      case "w":
        return "ew-resize";
    }
  };

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

        {/* Resize handles - all 8 positions */}
        {/* Top row */}
        <div
          className="absolute -top-1 -left-1 w-3 h-3 bg-blue-500 opacity-0 group-hover:opacity-100"
          style={{ cursor: "nwse-resize" }}
          onMouseDown={(e) => handleResizeStart(e, "nw")}
        />
        <div
          className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-3 h-3 bg-blue-500 opacity-0 group-hover:opacity-100"
          style={{ cursor: "ns-resize" }}
          onMouseDown={(e) => handleResizeStart(e, "n")}
        />
        <div
          className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 opacity-0 group-hover:opacity-100"
          style={{ cursor: "nesw-resize" }}
          onMouseDown={(e) => handleResizeStart(e, "ne")}
        />

        {/* Middle row */}
        <div
          className="absolute top-1/2 -left-1 transform -translate-y-1/2 w-3 h-3 bg-blue-500 opacity-0 group-hover:opacity-100"
          style={{ cursor: "ew-resize" }}
          onMouseDown={(e) => handleResizeStart(e, "w")}
        />
        <div
          className="absolute top-1/2 -right-1 transform -translate-y-1/2 w-3 h-3 bg-blue-500 opacity-0 group-hover:opacity-100"
          style={{ cursor: "ew-resize" }}
          onMouseDown={(e) => handleResizeStart(e, "e")}
        />

        {/* Bottom row */}
        <div
          className="absolute -bottom-1 -left-1 w-3 h-3 bg-blue-500 opacity-0 group-hover:opacity-100"
          style={{ cursor: "nesw-resize" }}
          onMouseDown={(e) => handleResizeStart(e, "sw")}
        />
        <div
          className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-3 h-3 bg-blue-500 opacity-0 group-hover:opacity-100"
          style={{ cursor: "ns-resize" }}
          onMouseDown={(e) => handleResizeStart(e, "s")}
        />
        <div
          className="absolute -bottom-1 -right-1 w-3 h-3 bg-blue-500 opacity-0 group-hover:opacity-100"
          style={{ cursor: "nwse-resize" }}
          onMouseDown={(e) => handleResizeStart(e, "se")}
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
