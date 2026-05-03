import { FastifyInstance } from "fastify";
import { ResolveSchema } from "../schemas/datetime.schema";
import { resolveDateTime } from "../services/resolution.service";
import { AppError } from "../utils/errors";

export async function resolveRoute(app: FastifyInstance) {
  app.post(
    "/v1/datetime/resolve",
    {
      schema: {
        summary: "Resolve a local datetime to UTC",
        description:
          "Resolve a local datetime in an IANA timezone to a definitive UTC instant using an explicit policy for ambiguous (DST overlap) and invalid (DST gap) inputs. Use this once an application or AI agent has decided how edge cases should be handled — for unknown user input, call /v1/datetime/validate first and ask the user to disambiguate.",
        tags: ["datetime"],
        body: {
          type: "object",
          required: ["local_datetime", "time_zone"],
          properties: {
            local_datetime: { type: "string", description: "ISO 8601 local datetime" },
            time_zone: { type: "string", description: "IANA timezone identifier" },
            resolution_policy: {
              type: "object",
              properties: {
                ambiguous: { type: "string", enum: ["earlier", "later", "reject"] },
                invalid: { type: "string", enum: ["next_valid_time", "previous_valid_time", "reject"] },
              },
            },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              instant_utc: { type: "string" },
              offset: { type: "string" },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const parsed = ResolveSchema.safeParse(request.body);
      if (!parsed.success) {
        return (reply as any).code(400).send({
          error: "Validation failed",
          code: "VALIDATION_FAILED",
          message: "Request body failed schema validation.",
          details: parsed.error.issues,
        });
      }

      const { local_datetime, time_zone, resolution_policy } = parsed.data;

      try {
        const result = resolveDateTime(local_datetime, time_zone, resolution_policy);
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
