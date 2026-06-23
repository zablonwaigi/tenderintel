import { requestHelp } from "@/app/workspace/actions";
import { Button, type ButtonProps } from "@/components/ui/Button";
import type { ServiceRequestKind } from "@/types/company";

/**
 * One-tap GrowYourBiz escalation. Renders a server-action form so it works
 * without client JS — every click creates a service_requests lead row.
 */
export function RequestHelpButton({
  kind,
  label,
  tenderId,
  message,
  redirect,
  variant = "outline",
  size = "sm",
  className,
}: {
  kind: ServiceRequestKind;
  label: string;
  tenderId?: string;
  message?: string;
  redirect?: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  className?: string;
}) {
  return (
    <form action={requestHelp} className="inline">
      <input type="hidden" name="kind" value={kind} />
      {tenderId && <input type="hidden" name="tender_id" value={tenderId} />}
      {message && <input type="hidden" name="message" value={message} />}
      {redirect && <input type="hidden" name="redirect" value={redirect} />}
      <Button type="submit" variant={variant} size={size} className={className}>
        {label}
      </Button>
    </form>
  );
}
