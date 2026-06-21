<?php

namespace App\Http\Requests\DepartmentOfficer;

use App\Enums\UserRole;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class AssignLecturerRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $departmentId = $this->attributes->get('department_id');

        return [
            // Any teaching staff in this department — a plain lecturer or an
            // officer (who is also a lecturer) attached to it. Session and
            // semester are derived from the academic calendar server-side.
            'lecturer_id' => ['required', 'integer',
                Rule::exists('users', 'id')
                    ->where('department_id', $departmentId)
                    ->whereIn('role', UserRole::teaching())],
        ];
    }
}
