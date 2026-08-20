import type { Request, Response } from "express";
import { db } from "../../models";
import { AuditLogService } from "../../services/auditLog.service";
import { errorResponse, successResponse } from "../../utils/response";
import { InternalNotifier } from "../notification/notification.service";

type MentionPayload = {
  employeeId?: string;
};

type NormalizedMention = {
  employeeId: string;
  userId: string;
  name: string;
  email?: string;
};

function sanitizeCommentBody(body: unknown) {
  return String(body || "")
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\u0000/g, "")
    .trim();
}

function commentErrorStatus(message: string) {
  if (["Project not found", "Task not found", "Comment not found"].includes(message)) {
    return 404;
  }
  return 400;
}

export class TaskCommentsController {
  private async ensureTask(businessId: string, projectId: string, taskId: string) {
    const task = await db.ProjectTask.findOne({
      where: { id: taskId, businessId, projectId },
      attributes: ["id", "title", "assigneeEmployeeId"],
    });
    if (!task) throw new Error("Task not found");
    return task;
  }

  private async normalizeMentions(
    businessId: string,
    projectId: string,
    task: any,
    rawMentions: unknown,
  ): Promise<NormalizedMention[]> {
    if (!Array.isArray(rawMentions)) return [];

    const employeeIds = Array.from(
      new Set(
        rawMentions
          .slice(0, 20)
          .map((mention: MentionPayload) => String(mention?.employeeId || "").trim())
          .filter(Boolean),
      ),
    );

    const mentions: NormalizedMention[] = [];

    for (const employeeId of employeeIds) {
      const employee = await db.EmployeeRecord.findOne({
        where: { id: employeeId, businessId },
        include: [
          {
            model: db.User,
            as: "user",
            attributes: ["id", "fullName", "email"],
          },
        ],
      });

      if (!employee?.userId || !employee.user) continue;

      const isAssignee = task.assigneeEmployeeId === employeeId;
      const isProjectMember = Boolean(
        await db.ProjectMember.findOne({
          where: { businessId, projectId, employeeId },
          attributes: ["id"],
        }),
      );

      if (!isAssignee && !isProjectMember) continue;

      mentions.push({
        employeeId,
        userId: employee.userId,
        name:
          employee.user.fullName ||
          employee.user.email ||
          employee.employeeCode ||
          "Team member",
        email: employee.user.email || undefined,
      });
    }

    return mentions;
  }

  private commentIncludes() {
    return [
      {
        model: db.EmployeeRecord,
        as: "author",
        required: false,
        include: [
          {
            model: db.User,
            as: "user",
            attributes: ["id", "fullName", "email"],
          },
        ],
      },
      {
        model: db.User,
        as: "authorUser",
        required: false,
        attributes: ["id", "fullName", "email"],
      },
    ];
  }

  private async notifyMentions(
    req: Request,
    task: any,
    commentId: string,
    mentions: NormalizedMention[],
  ) {
    const sender = await db.User.findByPk(req.user!.id, {
      attributes: ["id", "fullName", "email"],
    });
    const senderName = sender?.fullName || sender?.email || "A team member";

    for (const mention of mentions) {
      if (mention.userId === req.user!.id) continue;

      try {
        await InternalNotifier.send({
          businessId: req.user!.businessId,
          recipientUserId: mention.userId,
          senderUserId: req.user!.id,
          moduleKey: "projects",
          type: "mention",
          title: "Mentioned in task discussion",
          message: `${senderName} mentioned you on ${task.title}.`,
          entityType: "project_task",
          entityId: task.id,
          metadata: {
            projectId: req.params.projectId,
            taskId: task.id,
            commentId,
          },
        });
      } catch {
        // A notification failure must not block the comment itself.
      }
    }
  }

  list = async (req: Request, res: Response) => {
    try {
      await this.ensureTask(
        req.user!.businessId,
        req.params.projectId,
        req.params.taskId,
      );

      const comments = await db.TaskComment.findAll({
        where: {
          businessId: req.user!.businessId,
          projectId: req.params.projectId,
          taskId: req.params.taskId,
        },
        order: [["createdAt", "ASC"]],
        include: this.commentIncludes(),
      });

      successResponse(res, comments);
    } catch (error: any) {
      errorResponse(res, error.message, commentErrorStatus(error.message));
    }
  };

  create = async (req: Request, res: Response) => {
    try {
      const task = await this.ensureTask(
        req.user!.businessId,
        req.params.projectId,
        req.params.taskId,
      );
      const body = sanitizeCommentBody(req.body.body);
      if (!body) throw new Error("Comment body is required");

      const authorEmployee = await db.EmployeeRecord.findOne({
        where: {
          businessId: req.user!.businessId,
          userId: req.user!.id,
        },
        attributes: ["id"],
      });

      const mentions = await this.normalizeMentions(
        req.user!.businessId,
        req.params.projectId,
        task,
        req.body.metadata?.mentions,
      );
      const metadata = {
        ...(req.body.metadata || {}),
        mentions,
      };

      const comment = await db.TaskComment.create({
        businessId: req.user!.businessId,
        projectId: req.params.projectId,
        taskId: req.params.taskId,
        authorEmployeeId: authorEmployee?.id || null,
        authorUserId: req.user!.id,
        body,
        metadata,
      });

      await db.ProjectActivityLog.create({
        businessId: req.user!.businessId,
        projectId: req.params.projectId,
        taskId: req.params.taskId,
        actorEmployeeId: authorEmployee?.id || null,
        action: "TASK_COMMENTED",
        entityType: "task_comment",
        entityId: comment.id,
        after: comment.toJSON ? comment.toJSON() : comment,
      });

      await AuditLogService.log(
        "CREATE_TASK_COMMENT",
        "task_comment",
        String(comment.id),
        null,
        comment,
        req,
      );

      await this.notifyMentions(req, task, comment.id, mentions);

      const created = await db.TaskComment.findOne({
        where: { id: comment.id, businessId: req.user!.businessId },
        include: this.commentIncludes(),
      });

      successResponse(res, created || comment, "Comment created", 201);
    } catch (error: any) {
      errorResponse(res, error.message, commentErrorStatus(error.message));
    }
  };

  update = async (req: Request, res: Response) => {
    try {
      const task = await this.ensureTask(
        req.user!.businessId,
        req.params.projectId,
        req.params.taskId,
      );
      const comment = await db.TaskComment.findOne({
        where: {
          id: req.params.commentId,
          businessId: req.user!.businessId,
          projectId: req.params.projectId,
          taskId: req.params.taskId,
        },
      });
      if (!comment) throw new Error("Comment not found");

      const before = comment.toJSON ? comment.toJSON() : { ...comment };
      const body = sanitizeCommentBody(req.body.body);
      if (!body) throw new Error("Comment body is required");
      const mentions = await this.normalizeMentions(
        req.user!.businessId,
        req.params.projectId,
        task,
        req.body.metadata?.mentions,
      );
      const metadata = {
        ...(req.body.metadata || comment.metadata || {}),
        mentions,
      };

      await comment.update({ body, metadata });

      const actorEmployee = await db.EmployeeRecord.findOne({
        where: {
          businessId: req.user!.businessId,
          userId: req.user!.id,
        },
        attributes: ["id"],
      });

      await db.ProjectActivityLog.create({
        businessId: req.user!.businessId,
        projectId: req.params.projectId,
        taskId: req.params.taskId,
        actorEmployeeId: actorEmployee?.id || null,
        action: "TASK_COMMENT_UPDATED",
        entityType: "task_comment",
        entityId: comment.id,
        before,
        after: comment.toJSON ? comment.toJSON() : comment,
      });

      await AuditLogService.log(
        "UPDATE_TASK_COMMENT",
        "task_comment",
        String(comment.id),
        before,
        comment,
        req,
      );

      successResponse(res, comment, "Comment updated");
    } catch (error: any) {
      errorResponse(res, error.message, commentErrorStatus(error.message));
    }
  };

  remove = async (req: Request, res: Response) => {
    try {
      await this.ensureTask(
        req.user!.businessId,
        req.params.projectId,
        req.params.taskId,
      );
      const comment = await db.TaskComment.findOne({
        where: {
          id: req.params.commentId,
          businessId: req.user!.businessId,
          projectId: req.params.projectId,
          taskId: req.params.taskId,
        },
      });
      if (!comment) throw new Error("Comment not found");

      const before = comment.toJSON ? comment.toJSON() : { ...comment };
      const actorEmployee = await db.EmployeeRecord.findOne({
        where: {
          businessId: req.user!.businessId,
          userId: req.user!.id,
        },
        attributes: ["id"],
      });

      await comment.destroy();

      await db.ProjectActivityLog.create({
        businessId: req.user!.businessId,
        projectId: req.params.projectId,
        taskId: req.params.taskId,
        actorEmployeeId: actorEmployee?.id || null,
        action: "TASK_COMMENT_DELETED",
        entityType: "task_comment",
        entityId: comment.id,
        before,
      });

      await AuditLogService.log(
        "DELETE_TASK_COMMENT",
        "task_comment",
        String(comment.id),
        before,
        null,
        req,
      );

      successResponse(res, null, "Comment deleted");
    } catch (error: any) {
      errorResponse(res, error.message, commentErrorStatus(error.message));
    }
  };
}
