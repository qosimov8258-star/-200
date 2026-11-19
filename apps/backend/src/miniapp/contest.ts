import { MIN_AGE } from "../participants/participants.service";

/**
 * Tanlov sozlamalari. VAQTINCHA kodda; Faza 1 da `contest_settings`
 * jadvaliga ko'chadi va admin paneldan tahrirlanadi.
 */
export const contestSettings = {
  /** Tanlov tugash vaqti (UTC). Buyurtmachi bilan kelishilgach o'zgartiriladi (Q1). */
  endsAt: "2027-01-01T07:00:00.000Z",
  prizeName: "Chevrolet Cobalt",
  minAge: MIN_AGE,
};

