import { marked } from "marked";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import type { WikiArticle as WikiArticleType } from "@/types/wiki";

marked.setOptions({ gfm: true, breaks: false });

export function WikiArticle({ article }: { article: WikiArticleType }) {
  const html = marked.parse(article.content) as string;

  return (
    <Card>
      <CardBody className="p-6 md:p-8">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {article.form_code && <Badge variant="gold">{article.form_code}</Badge>}
          <Badge variant="gray">{article.category}</Badge>
          {article.tags?.map((tag) => (
            <Badge key={tag} variant="outline">{tag}</Badge>
          ))}
        </div>
        <article
          className="prose prose-sm max-w-none prose-headings:text-gray-900 prose-a:text-sa-green prose-th:text-left"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </CardBody>
    </Card>
  );
}
