import { FastifyInstance } from "fastify";
import { ConvertSchema } from "../schemas/datetime.schema";
import { convertTime } from "../services/conversion.service";
import { AppError } from "../utils/errors";

export async function convertRoute(app: FastifyInstance) {
  app.post(
    "/v1/datetime/convert",
    {
      schema: {
        summary: "Convert a UTC instant to local time",
        description:
          "Convert a UTC instant to a local datetime in a target IANA timezone. Use this when displaying a stored UTC timestamp to a user in their region or formatting a time for a destination timezone — a UTC instant maps to exactly one local time, so this is unambiguous. Do NOT use this to interpret user-entered local time; use /v1/datetime/validate or /v1/datetime/resolve for that.",
        tags: ["datetime"],
        body: {
          type: "object",
          required: ["instant_utc", "target_time_zone"],
          properties: {
            instant_utc: { type: "string", description: "ISO 8601 UTC datetime" },
            target_time_zone: { type: "string", description: "IANA timezone identifier" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              local_datetime: { type: "string" },
              offset: { type: "string" },
              time_zone: { type: "string" },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const parsed = ConvertSchema.safeParse(request.body);
      if (!parsed.success) {
        return (reply as any).code(400).send({
          error: "Validation failed",
          code: "VALIDATION_FAILED",
          message: "Request body failed schema validation.",
          details: parsed.error.issues,
        });
      }

      const { instant_utc, target_time_zone } = parsed.data;

      try {
        const result = convertTime(instant_utc, target_time_zone);
        return reply.send(result);
      } catch (err) {
        if (err instanceof AppError) {
          return reply.code(err.statusCode as any).send({
            error: err.message,
            code: err.code || "APP_ERROR",
            message: err.message,
          } as any);
        }
        throw err;
      }
    }
  );
}
