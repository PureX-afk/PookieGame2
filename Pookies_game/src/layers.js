// Render layers let each first-person camera skip its own body and see only
// its own hand, while still seeing the other player.
export const LAYER = {
  p1Body: 1,
  p2Body: 2,
  p1Hand: 3,
  p2Hand: 4,
};
