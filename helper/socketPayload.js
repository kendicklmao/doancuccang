// Payload socket tối thiểu (room chung: không phát nội dung mô tả / bình luận / email).
// assignees và columnId luôn là id; client cần nội dung thì gọi REST (có xác thực).
const idString = (v) => (v && typeof v === 'object' ? String(v._id || v.id) : v === null || v === undefined ? v : String(v));
const toTaskEvent = (task) => {
    const plain = typeof task.toObject === 'function' ? task.toObject() : { ...task };
    const { description, ...rest } = plain; // eslint-disable-line no-unused-vars
    return {
        ...rest,
        projectId: idString(rest.projectId),
        columnId: idString(rest.columnId),
        assignees: Array.isArray(rest.assignees) ? rest.assignees.map(idString) : [],
    };
};
const toCommentEvent = (comment, task) => ({
    _id: String(comment._id),
    taskId: String(comment.taskId || task._id),
    projectId: String(task.projectId),
});

module.exports = { toTaskEvent, toCommentEvent };
