<?php

namespace App\Http\Requests\DepartmentOfficer;

use App\Enums\Semester;
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
            // A lecturer can only be assigned to courses in their own department.
            'lecturer_id' => ['required', 'integer',
                Rule::exists('users', 'id')
                    ->where('department_id', $departmentId)
                    ->where('role', UserRole::Lecturer->value)],
            'session'     => ['required', 'string', 'regex:/^\d{4}\/\d{4}$/'],
            'semester'    => ['required', Rule::enum(Semester::class)],
        ];
    }
}
