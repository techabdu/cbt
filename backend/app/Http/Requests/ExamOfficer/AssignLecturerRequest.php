<?php

namespace App\Http\Requests\ExamOfficer;

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
        $schoolId = $this->attributes->get('school_id');

        return [
            'lecturer_id' => ['required', 'integer',
                Rule::exists('users', 'id')
                    ->where('school_id', $schoolId)
                    ->where('role', UserRole::Lecturer->value)],
            'session'     => ['required', 'string', 'regex:/^\d{4}\/\d{4}$/'],
            'semester'    => ['required', Rule::enum(Semester::class)],
        ];
    }
}
