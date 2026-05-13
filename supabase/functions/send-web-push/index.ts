import { createClient } from "npm:@supabase/supabase-js@2.49.8";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type SendPushPayload = {
  familyId: string;
  statusLogId?: string | null;
  title: string;
  body: string;
  url?: string | null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, 405);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
    const vapidSubject =
      Deno.env.get("VAPID_SUBJECT") || "mailto:admin@example.com";

    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse(
        { error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" },
        500
      );
    }

    if (!vapidPublicKey || !vapidPrivateKey) {
      return jsonResponse(
        { error: "Missing VAPID_PUBLIC_KEY or VAPID_PRIVATE_KEY" },
        500
      );
    }

    const payload: SendPushPayload = await req.json();

    if (!payload.familyId || !payload.title || !payload.body) {
      return jsonResponse(
        { error: "familyId, title, body are required" },
        400
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

    const { data: subscriptions, error: subscriptionError } = await supabase
      .from("push_subscriptions")
      .select("id, family_id, member_id, endpoint, p256dh, auth, status")
      .eq("family_id", payload.familyId)
      .eq("status", "active");

    if (subscriptionError) {
      return jsonResponse(
        {
          error: "Failed to load subscriptions",
          details: subscriptionError.message,
        },
        500
      );
    }

    if (!subscriptions || subscriptions.length === 0) {
      return jsonResponse(
        { error: "No active push subscriptions found for this family" },
        404
      );
    }

    const sendPayload = JSON.stringify({
      title: payload.title,
      body: payload.body,
      url: payload.url || "/parent-status.html",
      statusLogId: payload.statusLogId || null,
      familyId: payload.familyId,
      sentAt: new Date().toISOString(),
    });

    const results = [];

    for (const sub of subscriptions) {
      const jobInsert = await supabase
        .from("notification_jobs")
        .insert({
          family_id: payload.familyId,
          status_log_id: payload.statusLogId || null,
          subscription_id: sub.id,
          channel: "webpush",
          status: "queued",
        })
        .select("id")
        .single();

      const jobId = jobInsert.data?.id ?? null;

      try {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        };

        await webpush.sendNotification(pushSubscription, sendPayload);

        await supabase
          .from("push_subscriptions")
          .update({
            last_push_at: new Date().toISOString(),
            last_success_at: new Date().toISOString(),
            last_error_at: null,
            last_error_code: null,
          })
          .eq("id", sub.id);

        if (jobId) {
          await supabase
            .from("notification_jobs")
            .update({
              status: "sent",
              sent_at: new Date().toISOString(),
              error_message: null,
            })
            .eq("id", jobId);
        }

        results.push({
          subscriptionId: sub.id,
          status: "sent",
        });
      } catch (err) {
        const errorObj = err as {
          message?: string;
          statusCode?: number;
          body?: string;
          headers?: Record<string, string>;
        };

        const errorMessage =
          errorObj?.message || (err instanceof Error ? err.message : String(err));

        const errorDetails = {
          message: errorMessage,
          statusCode: errorObj?.statusCode ?? null,
          body: errorObj?.body ?? null,
          headers: errorObj?.headers ?? null,
        };

        console.error("web push send failed:", JSON.stringify(errorDetails));

        const isGone =
          errorMessage.includes("410") ||
          errorObj?.statusCode === 404 ||
          errorObj?.statusCode === 410 ||
          errorMessage.toLowerCase().includes("expired") ||
          errorMessage.toLowerCase().includes("unsubscribed");

        await supabase
          .from("push_subscriptions")
          .update({
            last_push_at: new Date().toISOString(),
            last_error_at: new Date().toISOString(),
            last_error_code: JSON.stringify(errorDetails).slice(0, 200),
            ...(isGone ? { status: "invalid" } : {}),
          })
          .eq("id", sub.id);

        if (jobId) {
          await supabase
            .from("notification_jobs")
            .update({
              status: "failed",
              error_message: JSON.stringify(errorDetails).slice(0, 500),
            })
            .eq("id", jobId);
        }

        results.push({
          subscriptionId: sub.id,
          status: "failed",
          error: errorDetails,
        });
      }
    }

    return jsonResponse({
      success: true,
      familyId: payload.familyId,
      total: subscriptions.length,
      results,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: message }, 500);
  }
});

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}