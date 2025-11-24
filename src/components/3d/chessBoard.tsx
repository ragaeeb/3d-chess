'use client';

/// <reference types="@react-three/fiber" />

import { OrbitControls } from '@react-three/drei';
import { type ChessBoardProps, useBoardElements } from '@/hooks/useBoardElements';
import Lights from './lights';

const ChessBoard: React.FC<ChessBoardProps> = (props) => {
    const boardElements = useBoardElements(props);

    return (
        <>
            <OrbitControls makeDefault minDistance={2} enableRotate={!props.cameraLocked} />
            <Lights />
            <mesh receiveShadow position={[0, -0.16, 0]}>
                <boxGeometry args={[8.8, 0.3, 8.8]} />
                <meshStandardMaterial color="#1a1818" />
            </mesh>
            {boardElements}
        </>
    );
};

export default ChessBoard;
