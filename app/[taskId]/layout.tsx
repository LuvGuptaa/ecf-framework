import { tasks } from "@/lib/tasks/registry"

export function generateStaticParams() {
    return Object.keys(tasks).map((taskId) => ({
        taskId,
    }))
}

export default function TaskLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return <>{children}</>
}
