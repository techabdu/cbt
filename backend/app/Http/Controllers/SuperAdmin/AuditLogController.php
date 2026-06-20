<?php

namespace App\Http\Controllers\SuperAdmin;

use App\Http\Controllers\Controller;
use App\Http\Resources\AuditLogResource;
use App\Models\AuditLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Spatie\QueryBuilder\AllowedFilter;
use Spatie\QueryBuilder\QueryBuilder;

class AuditLogController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $logs = QueryBuilder::for(AuditLog::class)
            ->with('user')
            ->allowedFilters(
                AllowedFilter::exact('action'),
                AllowedFilter::exact('user_id'),
                AllowedFilter::callback('search', function ($query, $value) {
                    $query->where(function ($q) use ($value) {
                        $q->where('action', 'like', "%{$value}%")
                          ->orWhereHas('user', fn ($u) => $u->where('name', 'like', "%{$value}%")
                              ->orWhere('file_number', 'like', "%{$value}%"));
                    });
                }),
            )
            ->defaultSort('-created_at')
            ->paginate((int) $request->integer('per_page', 25))
            ->appends($request->query());

        return AuditLogResource::collection($logs)->response();
    }
}
