import { Injectable } from "@nestjs/common";
import type {
  AiAgentActionName,
  AiAgentActionPolicyItem,
  AiAgentActionRisk,
  RequestUser,
  UserRole
} from "@propertyflow/contracts";

const roleRank: Record<UserRole, number> = {
  agent: 1,
  broker: 2,
  manager: 3,
  admin: 4
};

const actionRules: Record<
  AiAgentActionName,
  {
    risk: AiAgentActionRisk;
    minimumRole: UserRole;
    reason: string;
    blocked?: boolean;
    requiresConfirmationToken?: boolean;
  }
> = {
  "property.ai_description.generate": {
    risk: "background",
    minimumRole: "agent",
    reason: "AI can enqueue draft description generation because the output still requires review before applying."
  },
  "property.images.analyze": {
    risk: "background",
    minimumRole: "agent",
    reason: "AI can enqueue image analysis because detected features are saved as reviewable assets."
  },
  "property.ai_description.apply": {
    risk: "mutating",
    minimumRole: "agent",
    reason: "Applying generated text changes listing data and must be performed by an authenticated user after approval."
  },
  "property.ai_image_analysis.apply": {
    risk: "mutating",
    minimumRole: "agent",
    reason: "Applying image analysis changes amenities and must be performed by an authenticated user after approval."
  },
  "property.image.delete": {
    risk: "destructive",
    minimumRole: "agent",
    blocked: true,
    requiresConfirmationToken: true,
    reason:
      "AI agents cannot delete images directly. The client must request a delete preview and pass a short-lived confirmation token to the guarded delete endpoint."
  },
  "property.image.restore": {
    risk: "mutating",
    minimumRole: "manager",
    reason: "Restoring a removed image is a manager/admin recovery action and must be triggered explicitly by a user."
  },
  "property.publish": {
    risk: "mutating",
    minimumRole: "manager",
    reason: "Publishing changes public visibility and must be confirmed by a manager or admin."
  },
  "property.price.update": {
    risk: "mutating",
    minimumRole: "manager",
    reason: "Price updates affect commercial terms and must be confirmed by a manager or admin."
  }
};

@Injectable()
export class AiAgentActionPolicyService {
  evaluate(user: RequestUser, actions: AiAgentActionName[]): AiAgentActionPolicyItem[] {
    return [...new Set(actions)].map((action) => this.evaluateAction(user, action));
  }

  private evaluateAction(user: RequestUser, action: AiAgentActionName): AiAgentActionPolicyItem {
    const rule = actionRules[action];

    if (rule.blocked) {
      return {
        action,
        risk: rule.risk,
        decision: "blocked",
        reason: rule.reason,
        requiredRole: rule.minimumRole,
        requiresConfirmationToken: rule.requiresConfirmationToken
      };
    }

    if (roleRank[user.role] < roleRank[rule.minimumRole]) {
      return {
        action,
        risk: rule.risk,
        decision: "blocked",
        reason: `User role ${user.role} is below the required role ${rule.minimumRole}.`,
        requiredRole: rule.minimumRole
      };
    }

    if (rule.risk === "mutating") {
      return {
        action,
        risk: rule.risk,
        decision: "requires_human_confirmation",
        reason: rule.reason,
        requiredRole: rule.minimumRole
      };
    }

    return {
      action,
      risk: rule.risk,
      decision: "allowed",
      reason: rule.reason,
      requiredRole: rule.minimumRole
    };
  }
}
