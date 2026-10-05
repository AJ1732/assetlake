import { z } from "zod";

import {
  IMAGE_CROP_MODES,
  IMAGE_FIT_MODES,
  PRESET_QUALITY_RANGE,
} from "../constants";

const pixels = z.number().int().positive();

// Presets are editable content, so they are re-validated before they reach the URL builder:
// unknown fit/crop values or fractional sizes would produce broken or slow pipeline requests.
export const imageTransformSchema = z.object({
  width: pixels.optional(),
  height: pixels.optional(),
  quality: z
    .number()
    .int()
    .min(PRESET_QUALITY_RANGE.min)
    .max(PRESET_QUALITY_RANGE.max)
    .optional(),
  fit: z.enum(IMAGE_FIT_MODES).optional(),
  crop: z.enum(IMAGE_CROP_MODES).optional(),
  autoFormat: z.boolean().optional(),
});
