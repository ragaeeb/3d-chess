import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface CameraAnimatorProps {
    playerColor: 'white' | 'black' | null;
}

export const CameraAnimator: React.FC<CameraAnimatorProps> = ({ playerColor }) => {
    const { camera } = useThree();
    const targetPosition = useRef(new THREE.Vector3(10, 10, 10));
    const isAnimating = useRef(false);

    useEffect(() => {
        if (playerColor === 'black') {
            targetPosition.current.set(0, 12, -12);
        } else {
            targetPosition.current.set(0, 12, 12);
        }
        isAnimating.current = true;
    }, [playerColor]);

    useFrame((state, delta) => {
        if (!isAnimating.current) return;

        // Smoothly interpolate camera position
        const step = Math.min(2.5 * delta, 1);
        camera.position.lerp(targetPosition.current, step);

        if (camera.position.distanceTo(targetPosition.current) < 0.05) {
            camera.position.copy(targetPosition.current);
            isAnimating.current = false;
        }

        const controls = state.controls as any;
        if (controls) {
            controls.update();
        }
    });

    return null;
};
