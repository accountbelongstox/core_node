<?php

namespace App\Apps\VipClubV1\VipClubV1ArticlesCtl;

use App\Http\Controllers\Controller;
use App\Apps\VipClubV1\VipClubV1Models\VipClubV1ArticleModel;
use App\Apps\VipClubV1\VipClubV1Utils\VipClubV1ResponseUtils;
use App\Apps\VipClubV1\VipClubV1TablesMaps\VipClubV1TablesMap;
use App\Apps\VipClubV1\VipClubV1Gvar\VipClubV1Config;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class VipClubV1ArticlesCtl extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $page = $request->query('page', 1);
        $limit = min($request->query('limit', VipClubV1Config::PAGINATION_DEFAULT_LIMIT), VipClubV1Config::PAGINATION_MAX_LIMIT);

        $query = VipClubV1ArticleModel::published()->recent();

        if ($request->has('category') && $request->category) {
            $query->byCategory($request->category);
        }

        $total = $query->count();

        $articles = $query->skip(($page - 1) * $limit)
            ->take($limit)
            ->get();

        $formattedArticles = $articles->map(function ($article) {
            return $this->formatArticleResponse($article, false);
        });

        return VipClubV1ResponseUtils::paginated(
            $formattedArticles,
            $total,
            $page,
            $limit
        );
    }

    public function show(Request $request, $id): JsonResponse
    {
        $article = VipClubV1ArticleModel::find($id);

        if (!$article) {
            return VipClubV1ResponseUtils::notFound('Article not found');
        }

        if (!$article->{VipClubV1TablesMap::getFieldName('ARTICLES', 'is_published')}) {
            return VipClubV1ResponseUtils::notFound('Article not found');
        }

        $article->incrementReadCount();

        return VipClubV1ResponseUtils::success(
            $this->formatArticleResponse($article, true)
        );
    }

    public function getCategories(Request $request): JsonResponse
    {
        $categories = [
            'news',
            'events',
            'tips',
            'promotions',
            'announcements'
        ];

        return VipClubV1ResponseUtils::success([
            'categories' => $categories
        ]);
    }

    public function getFeatured(Request $request): JsonResponse
    {
        $limit = min($request->query('limit', 5), 20);

        $articles = VipClubV1ArticleModel::published()
            ->featured()
            ->recent()
            ->take($limit)
            ->get();

        $formattedArticles = $articles->map(function ($article) {
            return $this->formatArticleResponse($article, false);
        });

        return VipClubV1ResponseUtils::success([
            'featured_articles' => $formattedArticles
        ]);
    }

    private function formatArticleResponse(VipClubV1ArticleModel $article, bool $includeFullContent = false): array
    {
        $data = [
            'id' => $article->id,
            'title' => $article->{VipClubV1TablesMap::getFieldName('ARTICLES', 'title')},
            'summary' => $article->{VipClubV1TablesMap::getFieldName('ARTICLES', 'summary')},
            'category' => $article->{VipClubV1TablesMap::getFieldName('ARTICLES', 'category')},
            'coverImageUrl' => $article->{VipClubV1TablesMap::getFieldName('ARTICLES', 'cover_image_url')},
            'author' => $article->{VipClubV1TablesMap::getFieldName('ARTICLES', 'author')},
            'publishDate' => $article->{VipClubV1TablesMap::getFieldName('ARTICLES', 'publish_date')}?->toIso8601String(),
            'readCount' => $article->{VipClubV1TablesMap::getFieldName('ARTICLES', 'read_count')},
            'tags' => $article->{VipClubV1TablesMap::getFieldName('ARTICLES', 'tags')},
            'isFeatured' => $article->{VipClubV1TablesMap::getFieldName('ARTICLES', 'is_featured')}
        ];

        if ($includeFullContent) {
            $data['content'] = $article->{VipClubV1TablesMap::getFieldName('ARTICLES', 'content')};
        }

        return $data;
    }
}
