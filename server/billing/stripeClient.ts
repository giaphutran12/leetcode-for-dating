import Stripe from "stripe";

export function createStripeClient(
  environment: NodeJS.ProcessEnv = process.env,
): Stripe {
  const secretKey = environment.STRIPE_SECRET_KEY?.trim();
  if (!secretKey) {
    throw new Error("Stripe is not configured.");
  }
  return new Stripe(secretKey, {
    appInfo: {
      name: "RizzCode",
      version: "0.1.0",
    },
  });
}
