import React from 'react';
import { Star } from 'lucide-react';
import { motion } from 'framer-motion';

export interface StarFlight {
  id: number;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
}

interface StarFlightLayerProps {
  flights: StarFlight[];
  reducedMotion: boolean;
}

export const StarFlightLayer: React.FC<StarFlightLayerProps> = ({
  flights,
  reducedMotion,
}) => {
  if (!flights.length) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[60]" aria-hidden="true">
      {flights.map((flight) => {
        const dx = flight.toX - flight.fromX;
        const apex = Math.min(flight.fromY, flight.toY) - 64;

        return (
          <motion.span
            key={flight.id}
            className="absolute left-0 top-0"
            initial={{ x: flight.fromX, y: flight.fromY, opacity: 1, scale: 0.9 }}
            animate={
              reducedMotion
                ? { opacity: 0, transition: { duration: 0.16 } }
                : {
                    x: [flight.fromX, flight.fromX + dx * 0.42, flight.toX],
                    y: [flight.fromY, apex, flight.toY],
                    scale: [0.9, 1.05, 0.42],
                    opacity: [1, 1, 0],
                  }
            }
            transition={{ duration: 0.42, times: [0, 0.5, 1], ease: [0.4, 0, 0.55, 1] }}
          >
            <Star className="h-5 w-5 -translate-x-1/2 -translate-y-1/2 fill-butter-300 text-cocoa" />
          </motion.span>
        );
      })}
    </div>
  );
};
