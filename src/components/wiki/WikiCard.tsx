import Link from "next/link";
import { FileText, BookOpen, GraduationCap, Workflow } from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import type { WikiArticleListItem } from "@/types/wiki";

const ICONS: Record<string, React.ReactNode> = {
  form: <FileText className="h-5 w-5" />,
  guide: <GraduationCap className="h-5 w-5" />,
  process: <Workflow className="h-5 w-5" />,
  glossary: <BookOpen className="h-5 w-5" />,
};

export function WikiCard({ article }: { article: WikiArticleListItem }) {
  return (
    <Link href={`/wiki/${article.slug}`} className="group block">
      <Card className="h-full transition-shadow group-hover:shadow-md">
        <CardBody className="flex h-full flex-col">
          <div className="mb-3 flex items-center justify-between">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-sa-green/10 text-sa-green">
              {ICONS[article.category] ?? <BookOpen className="h-5 w-5" />}
            </span>
            {article.form_code && <Badge variant="gold">{article.form_code}</Badge>}
          </div>
          <h3 className="text-base font-semibold text-gray-900 group-hover:text-sa-green">
            {article.title}
          </h3>
          {article.summary && (
            <p className="mt-2 line-clamp-3 text-sm text-gray-600">{article.summary}</p>
          )}
          <div className="mt-auto pt-4">
            <Badge variant="gray">{article.category}</Badge>
          </div>
        </CardBody>
      </Card>
    </Link>
  );
}
