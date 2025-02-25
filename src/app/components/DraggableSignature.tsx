'use client';

import React from 'react';
import {useDraggable} from '@dnd-kit/core';
import {Resizable} from 'react-resizable';

interface Position {
    x: number;
    y: number;
}

interface Size {
    width: number;
    height: number;
}

interface DraggableSignatureProps {
    id: string;
    image: string;
    position: Position;
    size: Size;
    onResize: (id: string, newSize: Size) => void;
}

const CONFIG = {
    MIN_SIGNATURE_SIZE: [50, 25] as [number, number],
    MAX_SIGNATURE_SIZE: [300, 150] as [number, number],
};

const DraggableSignature = ({id, image, position, size, onResize}: DraggableSignatureProps) => {
    const {attributes, listeners, setNodeRef, transform} = useDraggable({
        id: id,
    });

    const style = transform ? {
        transform: `translate3d(${transform.x + position.x}px, ${transform.y + position.y}px, 0)`,
    } : {
        transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
    };

    return (
        <div
            ref={setNodeRef}
            style={{
                ...style,
                position: 'absolute',
                touchAction: 'none',
            }}
            {...listeners}
            {...attributes}
        >
            <Resizable
                width={size.width}
                height={size.height}
                minConstraints={CONFIG.MIN_SIGNATURE_SIZE}
                maxConstraints={CONFIG.MAX_SIGNATURE_SIZE}
                onResize={(_, {size: newSize}) => onResize(id, newSize)}
            >
                <div
                    style={{
                        width: '100%',
                        height: '100%',
                        border: '2px dashed #4f545c',
                        borderRadius: '0.375rem'
                    }}
                >
                    <img
                        src={image}
                        alt="Signature"
                        style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'contain'
                        }}
                    />
                </div>
            </Resizable>
        </div>
    );
};

export default DraggableSignature;